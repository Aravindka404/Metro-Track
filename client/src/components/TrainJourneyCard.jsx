import React from "react";
import { MapPin } from "lucide-react";

/**
 * TrainJourneyCard - Permanent mobile-friendly Ticket card layout:
 * 1. In how much time will the train arrive (Arrives in X mins / Due Now)
 * 2. Where it is now (Shifted to upper-right where earliest tag was - NO speed)
 * 3. Destination arrival time (Lower ticket half, left)
 * 4. Train name & direction (Lower ticket half, right)
 */
export function TrainJourneyCard({
  train,
  liveTrainData = null,
  isPrimary = false,
  isLight = false,
  onSelect,
}) {
  if (!train) return null;

  const isNorth = train.direction === 1;
  const directionGlyph = isNorth ? "▲" : "▼";
  const dotColor = isNorth
    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]";

  // 1. In how much time will the train arrive
  const etaHeadline = React.useMemo(() => {
    if (train.waitEtaSeconds !== undefined && train.waitEtaSeconds !== null) {
      if (train.waitEtaSeconds <= 45) {
        return "Arriving Now";
      }
      const mins = Math.max(1, Math.round(train.waitEtaSeconds / 60));
      return `in ${mins} min${mins > 1 ? "s" : ""}`;
    }
    if (train.departureDisplay) {
      const depLower = train.departureDisplay.toLowerCase();
      if (depLower.includes("arriving") || depLower.includes("due")) {
        return "Arriving Now";
      }
      return train.departureDisplay;
    }
    return train.depTime || "Scheduled";
  }, [train]);

  // 2. Where it is now (Physical location - STRICTLY NO SPEED)
  const locationText = React.useMemo(() => {
    if (liveTrainData?.isDwelling) {
      return `At ${liveTrainData.nextStation || "station"} Platform`;
    }
    if (liveTrainData?.nextStation) {
      return `Approaching ${liveTrainData.nextStation}`;
    }
    if (train.status && !train.status.toLowerCase().includes("km/h")) {
      return train.status;
    }
    return train.isLive ? "In corridor transit" : `Scheduled departure`;
  }, [liveTrainData, train]);

  // 3. Destination arrival time
  const destArrivalTime = train.arrTime || "--:--";

  // 4. Train name
  const trainName = `KMRL-${train.displayId}`;

  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border transition-all cursor-pointer active:scale-[0.99] overflow-hidden ${
        isPrimary
          ? isLight
            ? "bg-slate-50 border-teal-300 shadow-[0_2px_12px_rgba(20,184,166,0.12)] hover:border-teal-400"
            : "bg-slate-900/95 border-teal-500/40 shadow-[0_2px_16px_rgba(20,184,166,0.15)] hover:border-teal-400/60"
          : isLight
          ? "bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-900 shadow-xs"
          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.07] text-white"
      }`}
    >
      {/* Upper ticket section: Arrive Time on left, Current Location on right */}
      <div className="px-3.5 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          {/* 1. In how much time will the train arrive */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`font-mono text-lg sm:text-xl font-black ${
                etaHeadline === "Arriving Now"
                  ? isLight
                    ? "text-emerald-600"
                    : "text-emerald-400"
                  : isLight
                  ? "text-teal-700"
                  : "text-teal-400"
              }`}
            >
              {etaHeadline}
            </span>
          </div>

          {/* 2. Where it is now (Shifted to right where chip was sitting) */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-semibold truncate max-w-[62%] ${
              isLight
                ? "bg-slate-100/90 border-slate-200 text-slate-700"
                : "bg-white/5 border-white/10 text-slate-300"
            }`}
            title={locationText}
          >
            <MapPin
              size={11}
              className={`shrink-0 ${isLight ? "text-teal-600" : "text-teal-400"}`}
            />
            <span className="truncate">{locationText}</span>
          </div>
        </div>
      </div>

      {/* Perforated ticket separator line */}
      <div className="relative flex items-center px-2">
        <div
          className={`w-2.5 h-2.5 rounded-full -ml-3.5 border ${
            isLight ? "bg-white border-slate-300/80" : "bg-[#0E1626] border-white/15"
          }`}
        />
        <div
          className={`flex-1 border-t border-dashed ${
            isLight ? "border-slate-300/80" : "border-white/15"
          }`}
        />
        <div
          className={`w-2.5 h-2.5 rounded-full -mr-3.5 border ${
            isLight ? "bg-white border-slate-300/80" : "bg-[#0E1626] border-white/15"
          }`}
        />
      </div>

      {/* Lower ticket section: Dest Arrival on left, Train Name on right */}
      <div
        className={`px-3.5 py-2 sm:py-2.5 flex items-center justify-between text-xs font-sans ${
          isLight ? "bg-slate-100/70 text-slate-600" : "bg-white/[0.02] text-slate-400"
        }`}
      >
        {/* 3. Destination arrival time */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
            Dest. Arrival
          </span>
          <strong
            className={`font-mono font-bold ${isLight ? "text-slate-900" : "text-white"}`}
          >
            {destArrivalTime}
          </strong>
        </div>

        {/* 4. Train name & direction */}
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className={isLight ? "text-slate-900" : "text-white"}>
            {trainName}
          </span>
          <span className="text-[10px] opacity-70">{directionGlyph}</span>
        </div>
      </div>
    </div>
  );
}

export default TrainJourneyCard;
