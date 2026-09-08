/**
 * Kochi Metro 3D Train Geometry & Mesh Generator
 * Built with Three.js
 * 
 * Accurately models a sleek, modern low-poly Kochi Metro rail car
 * featuring the signature KMRL livery:
 * - Teal (#00A896 / #008080)
 * - Bright Green (#8CC63F / #7CB342)
 * - Metallic Silver Body (#EAEEF3)
 * - Tinted Glass Windows (#1E293B)
 * - LED Headlights and Roof AC units
 */

import * as THREE from 'three';

export function createKochiMetroTrainMesh(options = {}) {
  const {
    carLength = 22,    // Length of one metro car in meters (standard Metro car ~21.5m)
    carWidth = 2.8,    // Width of metro car (~2.88m)
    carHeight = 3.6,   // Height of car above rail (~3.8m)
    carsCount = 3,     // Kochi Metro standard 3-car rake (DMC-TC-DMC)
    colorTeal = 0x00A896,
    colorGreen = 0x8CC63F,
    colorBody = 0xEAEEF3,
    colorRoof = 0xCBD5E1,
    colorGlass = 0x1E293B,
    colorDark = 0x334155,
  } = options;

  const trainGroup = new THREE.Group();
  trainGroup.name = "KochiMetroTrain";

  // Reusable materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: colorBody,
    roughness: 0.35,
    metalness: 0.6,
  });

  const tealMaterial = new THREE.MeshStandardMaterial({
    color: colorTeal,
    roughness: 0.3,
    metalness: 0.3,
  });

  const greenMaterial = new THREE.MeshStandardMaterial({
    color: colorGreen,
    roughness: 0.3,
    metalness: 0.3,
  });

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: colorRoof,
    roughness: 0.7,
    metalness: 0.4,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: colorGlass,
    roughness: 0.1,
    metalness: 0.9,
    transmission: 0.4,
    opacity: 0.9,
    transparent: true,
  });

  const undercarriageMaterial = new THREE.MeshStandardMaterial({
    color: colorDark,
    roughness: 0.8,
    metalness: 0.7,
  });

  const headlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xEEFFFF,
  });

  const taillightMaterial = new THREE.MeshBasicMaterial({
    color: 0xFF2222,
  });

  const gap = 0.6; // Gangway connector gap between cars

  for (let c = 0; c < carsCount; c++) {
    const carGroup = new THREE.Group();
    const isFrontCar = c === 0;
    const isRearCar = c === carsCount - 1;
    const zOffset = (c - (carsCount - 1) / 2) * (carLength + gap);
    carGroup.position.z = zOffset;

    // 1. Main Car Body
    const mainBodyGeo = new THREE.BoxGeometry(carWidth, carHeight * 0.7, carLength);
    const mainBody = new THREE.Mesh(mainBodyGeo, bodyMaterial);
    mainBody.position.y = carHeight * 0.55;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    carGroup.add(mainBody);

    // 2. Teal KMRL Stripe along lower-mid body
    const stripeGeo = new THREE.BoxGeometry(carWidth * 1.01, carHeight * 0.18, carLength);
    const tealStripe = new THREE.Mesh(stripeGeo, tealMaterial);
    tealStripe.position.y = carHeight * 0.42;
    carGroup.add(tealStripe);

    // 3. Green Eco Accent Stripe
    const greenStripeGeo = new THREE.BoxGeometry(carWidth * 1.012, carHeight * 0.05, carLength);
    const greenStripe = new THREE.Mesh(greenStripeGeo, greenMaterial);
    greenStripe.position.y = carHeight * 0.53;
    carGroup.add(greenStripe);

    // 4. Tinted Ribbon Windows (Sides)
    const windowStripGeo = new THREE.BoxGeometry(carWidth * 1.015, carHeight * 0.24, carLength * 0.86);
    const windows = new THREE.Mesh(windowStripGeo, glassMaterial);
    windows.position.y = carHeight * 0.68;
    carGroup.add(windows);

    // 5. Roof Curve / Casing
    const roofGeo = new THREE.CylinderGeometry(
      carWidth * 0.52,
      carWidth * 0.52,
      carLength * 0.98,
      16,
      1,
      false,
      0,
      Math.PI
    );
    roofGeo.rotateZ(-Math.PI / 2);
    roofGeo.rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, roofMaterial);
    roof.position.y = carHeight * 0.88;
    carGroup.add(roof);

    // 6. Rooftop HVAC units (Air Conditioners)
    const hvacGeo = new THREE.BoxGeometry(carWidth * 0.65, 0.4, 4.0);
    const hvacFront = new THREE.Mesh(hvacGeo, undercarriageMaterial);
    hvacFront.position.set(0, carHeight * 0.95, carLength * 0.25);
    carGroup.add(hvacFront);

    const hvacRear = new THREE.Mesh(hvacGeo, undercarriageMaterial);
    hvacRear.position.set(0, carHeight * 0.95, -carLength * 0.25);
    carGroup.add(hvacRear);

    // 7. Undercarriage & Bogies (Wheels)
    const chassisGeo = new THREE.BoxGeometry(carWidth * 0.85, 0.35, carLength * 0.92);
    const chassis = new THREE.Mesh(chassisGeo, undercarriageMaterial);
    chassis.position.y = 0.2;
    carGroup.add(chassis);

    // Bogie wheel assemblies
    [-carLength * 0.35, carLength * 0.35].forEach((bogieZ) => {
      const bogie = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.9, 0.45, 2.4),
        undercarriageMaterial
      );
      bogie.position.set(0, 0.25, bogieZ);
      carGroup.add(bogie);
    });

    // 8. Aerodynamic Driver Nose Cone (Cab Front & Rear)
    if (isFrontCar) {
      // Sleek tapered nose at front (+Z direction)
      const noseGeo = new THREE.ConeGeometry(carWidth * 0.52, 2.2, 4);
      noseGeo.rotateX(-Math.PI / 2);
      noseGeo.rotateY(Math.PI / 4);
      const nose = new THREE.Mesh(noseGeo, tealMaterial);
      nose.position.set(0, carHeight * 0.55, carLength / 2 + 1.0);
      nose.scale.set(1.0, 0.7, 1.0);
      carGroup.add(nose);

      // Front Windshield
      const windshieldGeo = new THREE.BoxGeometry(carWidth * 0.8, carHeight * 0.32, 0.5);
      const windshield = new THREE.Mesh(windshieldGeo, glassMaterial);
      windshield.position.set(0, carHeight * 0.68, carLength / 2 + 0.9);
      windshield.rotation.x = -0.25;
      carGroup.add(windshield);

      // Bright LED Headlights
      [-0.85, 0.85].forEach((xPos) => {
        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8), headlightMaterial);
        light.rotation.x = Math.PI / 2;
        light.position.set(xPos, carHeight * 0.42, carLength / 2 + 1.15);
        carGroup.add(light);
      });
    }

    if (isRearCar) {
      // Red Tail Lights at back (-Z direction)
      [-0.85, 0.85].forEach((xPos) => {
        const light = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), taillightMaterial);
        light.rotation.x = Math.PI / 2;
        light.position.set(xPos, carHeight * 0.42, -carLength / 2 - 0.1);
        carGroup.add(light);
      });
    }

    // Gangway connection bellows (between cars)
    if (!isRearCar) {
      const gangway = new THREE.Mesh(
        new THREE.BoxGeometry(carWidth * 0.75, carHeight * 0.6, gap * 1.1),
        undercarriageMaterial
      );
      gangway.position.set(0, carHeight * 0.52, carLength / 2 + gap / 2);
      carGroup.add(gangway);
    }

    trainGroup.add(carGroup);
  }

  return trainGroup;
}
