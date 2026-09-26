import React from 'react';
import { Shuffle, CheckCircle2 } from 'lucide-react';

/**
 * TransferJourneyCard:
 * Unified transfer card featuring the Classic Rail method, designed to seamlessly
 * match the standard TrainJourneyCard UI:
 * - Upper ticket section: Boarding arrival time / ETA on left, Transfer station pill on right.
 * - Perforated ticket separator line with side circular notches.
 * - Classic Rail middle body: Vertical rail track on side, Leg 1 on top, Centered transfer bridge, Leg 2 below.
 * - Lower ticket section: Dest. Arrival on left, transfer note on right.
 * - "Depart Later" support: Updates all timings dynamically based on selected departure time.
 * - Clean, natural everyday language (NO "alight").
 * - Line identity badges (Purple Line, Green Line, Yellow Line) strictly aligned to the RIGHT SIDE.
 */
export function TransferJourneyCard({
  interchangeDetails,
  originStation,
  destinationStation,
  leg1LiveTrain = null,
  selectedTime = null,
  isLight = false,
  onSelectLeg1Train,
}) {
  if (!interchangeDetails || !interchangeDetails.isInterchange) return null;

  const {
    leg1,
    transfer,
    leg2,
    middleLeg,
    transfer1,
    transfer2,
    isDoubleTransfer,
    totalRideMinutes,
  } = interchangeDetails;

  // Short station name helper (e.g. "Nadaprabhu Kempegowda (Majestic)" -> "Majestic")
  const getShortStationName = (name) => {
    if (!name) return 'Interchange';
    if (name.includes('Majestic')) return 'Majestic';
    if (name.includes('RV Road') || name.includes('Rashtreeya Vidyalaya')) return 'RV Road';
    return name.split('(')[0]?.trim() || name;
  };

  const primaryTransferStation = getShortStationName(
    isDoubleTransfer ? transfer1?.stationName : transfer?.stationName
  );

  // 1. Primary ETA / Departure Time at Boarding Station (Matches TrainJourneyCard)
  const etaHeadline = React.useMemo(() => {
    // If user specified custom departure time or train is scheduled:
    if (selectedTime || leg1LiveTrain?.isLive === false) {
      if (leg1LiveTrain?.depTime) {
        return leg1LiveTrain.depTime;
      }
      if (selectedTime) {
        const [hStr, mStr] = selectedTime.split(':');
        let h = parseInt(hStr, 10);
        const m = mStr || '00';
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
      }
    }

    if (leg1LiveTrain?.waitEtaSeconds !== undefined && leg1LiveTrain?.waitEtaSeconds !== null) {
      if (leg1LiveTrain.waitEtaSeconds <= 45) return 'Arriving Now';
      const mins = Math.max(1, Math.round(leg1LiveTrain.waitEtaSeconds / 60));
      return `in ${mins} min${mins > 1 ? 's' : ''}`;
    }

    if (leg1LiveTrain?.departureDisplay) {
      const depLower = leg1LiveTrain.departureDisplay.toLowerCase();
      if (depLower.includes('arriving') || depLower.includes('due')) {
        return 'Arriving Now';
      }
      return leg1LiveTrain.departureDisplay;
    }

    return 'in ~4 mins';
  }, [leg1LiveTrain, selectedTime]);

  // 2. Destination arrival time (Updates accurately with Depart Later)
  const destArrivalTime = React.useMemo(() => {
    // If departure time is scheduled from custom time:
    if ((selectedTime || leg1LiveTrain?.isLive === false) && leg1LiveTrain?.depTime) {
      const match = leg1LiveTrain.depTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const isPM = match[3]?.toUpperCase() === 'PM';
        const isAM = match[3]?.toUpperCase() === 'AM';
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;

        const d = new Date();
        d.setHours(h, m, 0, 0);
        const destD = new Date(d.getTime() + (totalRideMinutes || 30) * 60000);
        return destD.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    }

    if (selectedTime && typeof selectedTime === 'string') {
      const parts = selectedTime.split(':').map(Number);
      const d = new Date();
      d.setHours(parts[0] || 0, (parts[1] || 0) + (totalRideMinutes || 30), 0, 0);
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    const now = Date.now();
    const waitMs = (leg1LiveTrain?.waitEtaSeconds || 180) * 1000;
    const journeyMs = (totalRideMinutes || 30) * 60 * 1000;
    const destDate = new Date(now + waitMs + journeyMs);
    return destDate.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, [leg1LiveTrain, selectedTime, totalRideMinutes]);

  // Line badge helper - ALWAYS on the right side
  const renderLineBadge = (lineKey, lineName) => {
    const isPurple = lineKey === 'purple';
    const isYellow = lineKey === 'yellow';

    if (isPurple) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)] shrink-0" />
          {lineName || 'Purple Line'}
        </span>
      );
    }
    if (isYellow) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-yellow-400/15 text-yellow-500 dark:text-yellow-400 border border-yellow-400/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)] shrink-0" />
          {lineName || 'Yellow Line'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0" />
        {lineName || 'Green Line'}
      </span>
    );
  };

  const getLineBorderClass = (lineKey) => {
    if (lineKey === 'purple') return 'border-purple-400/60';
    if (lineKey === 'yellow') return 'border-yellow-400/60';
    return 'border-emerald-400/60';
  };

  const getLineBgDotClass = (lineKey) => {
    if (lineKey === 'purple') return 'bg-purple-600 text-white';
    if (lineKey === 'yellow') return 'bg-yellow-400 text-slate-950 font-black';
    return 'bg-emerald-600 text-white';
  };

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden ${
        isLight
          ? 'bg-slate-50 border-teal-300 shadow-[0_2px_12px_rgba(20,184,166,0.12)] hover:border-teal-400 text-slate-900'
          : 'bg-slate-900/95 border-teal-500/40 shadow-[0_2px_16px_rgba(20,184,166,0.15)] hover:border-teal-400/60 text-white'
      }`}
    >
      {/* ================= UPPER TICKET SECTION ================= */}
      {/* Matches TrainJourneyCard: Arrival/ETA on left, Location/Status chip on right */}
      <div
        onClick={() => leg1LiveTrain && onSelectLeg1Train && onSelectLeg1Train(leg1LiveTrain)}
        className={`px-3.5 py-2.5 sm:py-3 flex items-center justify-between gap-2 ${
          leg1LiveTrain?.isLive ? 'cursor-pointer' : ''
        }`}
      >
        {/* 1. Primary Boarding Station Arrival Time */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`font-mono text-lg sm:text-xl font-black ${
              etaHeadline === 'Arriving Now'
                ? isLight
                  ? 'text-emerald-600'
                  : 'text-emerald-400'
                : isLight
                ? 'text-teal-700'
                : 'text-teal-400'
            }`}
          >
            {etaHeadline}
          </span>
          {selectedTime && (
            <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider">
              (Scheduled)
            </span>
          )}
        </div>

        {/* 2. Transfer Location Pill (Matches TrainJourneyCard's right chip) */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold truncate max-w-[62%] ${
            isLight
              ? 'bg-slate-100/90 border-slate-200 text-slate-700'
              : 'bg-white/5 border-white/10 text-slate-300'
          }`}
          title={isDoubleTransfer ? 'Transfer at Majestic & RV Road' : `Transfer at ${primaryTransferStation}`}
        >
          <Shuffle
            size={11}
            className={`shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
          />
          <span className="truncate">
            {isDoubleTransfer ? 'Change at Majestic & RV Road' : `Change at ${primaryTransferStation}`}
          </span>
        </div>
      </div>

      {/* ================= PERFORATED TICKET SEPARATOR LINE ================= */}
      <div className="relative flex items-center px-2">
        <div
          className={`w-2.5 h-2.5 rounded-full -ml-3.5 border ${
            isLight ? 'bg-white border-slate-300/80' : 'bg-[#0E1626] border-white/15'
          }`}
        />
        <div
          className={`flex-1 border-t border-dashed ${
            isLight ? 'border-slate-300/80' : 'border-white/15'
          }`}
        />
        <div
          className={`w-2.5 h-2.5 rounded-full -mr-3.5 border ${
            isLight ? 'bg-white border-slate-300/80' : 'bg-[#0E1626] border-white/15'
          }`}
        />
      </div>

      {/* ================= CLASSIC RAIL MIDDLE BODY ================= */}
      {/* Unified Single Column with Continuous Rail Track on Left Side */}
      <div className="px-3.5 py-3 sm:py-3.5 flex flex-col">
        {/* ROW 1: LEG 1 (BOARDING TRAIN) */}
        <div
          onClick={() => leg1LiveTrain && onSelectLeg1Train && onSelectLeg1Train(leg1LiveTrain)}
          className={`flex gap-3 items-stretch ${
            leg1LiveTrain?.isLive ? 'cursor-pointer' : ''
          }`}
          title={leg1LiveTrain?.isLive ? `Track Train ${leg1LiveTrain.id} Live` : undefined}
        >
          {/* Side Rail Track: Node 1 + Vertical dashed line */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-black shadow-sm ${getLineBgDotClass(
                leg1.line
              )}`}
            >
              1
            </div>
            <div
              className={`w-0.5 flex-1 min-h-[34px] my-1 border-l-2 border-dashed ${getLineBorderClass(
                leg1.line
              )}`}
            />
          </div>

          {/* Leg 1 Information */}
          <div className="flex-1 min-w-0 pb-1 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1">
              <span className="font-sans text-xs sm:text-sm font-bold tracking-tight truncate">
                Board train towards {leg1.directionName}
              </span>
              {/* Line Badge STRICTLY on the Right */}
              {renderLineBadge(leg1.line, leg1.lineName)}
            </div>
            <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mt-1">
              <span className="truncate">From {originStation?.name || 'Origin'}</span>
              <span className="shrink-0 font-mono font-medium">
                {leg1.hops} stops • ~{leg1.rideMinutes} mins
              </span>
            </div>
          </div>
        </div>

        {/* CENTERED TRANSFER BRIDGE (NOT A SEPARATE CARD, CENTERED ICON) */}
        <div className="my-2 flex items-center justify-center gap-2">
          <div
            className={`flex-1 border-t border-dashed ${
              isLight ? 'border-amber-300/80' : 'border-amber-500/30'
            }`}
          />
          <div
            className={`px-3 py-1 rounded-full border flex items-center gap-2 text-xs font-semibold shadow-2xs ${
              isLight
                ? 'bg-amber-100/70 border-amber-300 text-amber-900'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-200'
            }`}
          >
            {/* Centered Transfer Icon */}
            <Shuffle size={13} className="text-amber-500 shrink-0" strokeWidth={2.5} />
            <span className="font-sans text-[11px] sm:text-xs">
              Change trains at <strong>{primaryTransferStation}</strong> • ~{isDoubleTransfer ? (transfer1?.walkMinutes || 4) : (transfer?.walkMinutes || 4)} min walk
            </span>
          </div>
          <div
            className={`flex-1 border-t border-dashed ${
              isLight ? 'border-amber-300/80' : 'border-amber-500/30'
            }`}
          />
        </div>

        {/* Note: Stay inside station */}
        <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-500 mb-2">
          <CheckCircle2 size={11} strokeWidth={2.5} />
          <span>Same ticket valid • Stay inside station</span>
        </div>

        {/* MIDDLE LEG (DOUBLE TRANSFER ONLY) */}
        {isDoubleTransfer && middleLeg && (
          <>
            <div className="flex gap-3 items-stretch">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-black shadow-sm ${getLineBgDotClass(
                    middleLeg.line
                  )}`}
                >
                  2
                </div>
                <div
                  className={`w-0.5 flex-1 min-h-[34px] my-1 border-l-2 border-dashed ${getLineBorderClass(
                    middleLeg.line
                  )}`}
                />
              </div>

              <div className="flex-1 min-w-0 pb-1 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-sans text-xs sm:text-sm font-bold tracking-tight truncate">
                    Take train towards {middleLeg.directionName}
                  </span>
                  {renderLineBadge(middleLeg.line, middleLeg.lineName)}
                </div>
                <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mt-1">
                  <span>{middleLeg.hops} stops</span>
                  <span className="font-mono font-medium">~{middleLeg.rideMinutes} mins</span>
                </div>
              </div>
            </div>

            {/* CENTERED TRANSFER BRIDGE 2 */}
            <div className="my-2 flex items-center justify-center gap-2">
              <div
                className={`flex-1 border-t border-dashed ${
                  isLight ? 'border-amber-300/80' : 'border-amber-500/30'
                }`}
              />
              <div
                className={`px-3 py-1 rounded-full border flex items-center gap-2 text-xs font-semibold shadow-2xs ${
                  isLight
                    ? 'bg-amber-100/70 border-amber-300 text-amber-900'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                }`}
              >
                <Shuffle size={13} className="text-amber-500 shrink-0" strokeWidth={2.5} />
                <span className="font-sans text-[11px] sm:text-xs">
                  Change trains at <strong>{getShortStationName(transfer2?.stationName || 'RV Road')}</strong> • ~{transfer2?.walkMinutes || 3} min walk
                </span>
              </div>
              <div
                className={`flex-1 border-t border-dashed ${
                  isLight ? 'border-amber-300/80' : 'border-amber-500/30'
                }`}
              />
            </div>
          </>
        )}

        {/* ROW FINAL: CONNECTING TRAIN TO DESTINATION */}
        <div className="flex gap-3 items-stretch">
          {/* Side Rail Track: Connecting vertical line + Circle 2 (or 3) */}
          <div className="flex flex-col items-center shrink-0">
            <div
              className={`w-0.5 h-3 my-0.5 border-l-2 border-dashed ${getLineBorderClass(
                leg2.line
              )}`}
            />
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-black shadow-sm ${getLineBgDotClass(
                leg2.line
              )}`}
            >
              {isDoubleTransfer ? '3' : '2'}
            </div>
          </div>

          {/* Connecting Leg Information */}
          <div className="flex-1 min-w-0 pt-0.5 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1">
              <span className="font-sans text-xs sm:text-sm font-bold tracking-tight truncate">
                Take connecting train towards {leg2.directionName}
              </span>
              {/* Line Badge STRICTLY on the Right */}
              {renderLineBadge(leg2.line, leg2.lineName)}
            </div>
            <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mt-1">
              <span className="truncate">Exit at {destinationStation?.name || 'Destination'}</span>
              <span className="shrink-0 font-mono font-medium">
                {leg2.hops} stops to destination • ~{leg2.rideMinutes} mins
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= LOWER TICKET SECTION ================= */}
      {/* Matches TrainJourneyCard: Dest. Arrival on left, Journey badge on right */}
      <div
        className={`px-3.5 py-2 sm:py-2.5 flex items-center justify-between text-xs font-sans border-t ${
          isLight
            ? 'bg-slate-100/70 border-slate-200/80 text-slate-600'
            : 'bg-white/[0.02] border-white/5 text-slate-400'
        }`}
      >
        {/* Dest. Arrival */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
            Dest. Arrival
          </span>
          <strong
            className={`font-mono font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            ~{destArrivalTime}
          </strong>
        </div>

        {/* Transfer badge */}
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
          <span className={isLight ? 'text-slate-900' : 'text-white'}>
            {isDoubleTransfer ? '2 Transfers (Majestic & RV Road)' : `Transfer at ${primaryTransferStation}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TransferJourneyCard;
