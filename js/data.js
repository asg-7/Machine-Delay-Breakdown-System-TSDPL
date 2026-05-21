// Mock dataset for TSDPL Kalinganagar Production Analytics Dashboard
var RAW_DATA = [
  // WCTL-1 Mock Dataset
  {
    date: "10.05.2026",
    shift: "A",
    incharge: "NAGESHWAR REDDY",
    team: "Anshuman, Rajesh & Team",
    machine: "WCTL-1",
    tonnage: 236.13,
    coils: 12,
    delays: [{ time: 45, type: "MAINTENANCE BREAKDOWN", description: "Hydraulic pump failure" }]
  },
  {
    date: "12.05.2026",
    shift: "B",
    incharge: "SUNIL PRADHAN",
    team: "Ranjeet & Team",
    machine: "WCTL-1",
    tonnage: 180.50,
    coils: 8,
    delays: [{ time: 15, type: "COIL FEEDING DELAY", description: "Coil centering issue" }]
  },
  {
    date: "15.05.2026",
    shift: "C",
    incharge: "RAHUL KUMAR",
    team: "Anurag & Team",
    machine: "WCTL-1",
    tonnage: 251.20,
    coils: 14,
    delays: [{ time: 60, type: "MAINTENANCE BREAKDOWN", description: "Shear motor overload" }]
  },
  {
    date: "18.05.2026",
    shift: "A",
    incharge: "NAGESHWAR REDDY",
    team: "Anshuman, Rajesh & Team",
    machine: "WCTL-1",
    tonnage: 218.40,
    coils: 11,
    delays: [{ time: 90, type: "MAINTENANCE BREAKDOWN", description: "Loop car guide jam" }]
  },
  // WCTL-2 Mock Dataset
  {
    date: "08.05.2026",
    shift: "A",
    incharge: "RAHUL KUMAR",
    team: "Anurag & Team",
    machine: "WCTL-2",
    tonnage: 148.90,
    coils: 5,
    delays: [{ time: 120, type: "MAINTENANCE BREAKDOWN", description: "Welder sensor malfunction" }]
  },
  {
    date: "11.05.2026",
    shift: "B",
    incharge: "SUNIL PRADHAN",
    team: "Ranjeet & Team",
    machine: "WCTL-2",
    tonnage: 212.10,
    coils: 9,
    delays: [{ time: 20, type: "SETUP DELAY", description: "Blade alignment" }]
  },
  {
    date: "14.05.2026",
    shift: "C",
    incharge: "JAGANNATH REDDY",
    team: "Sanjay & Team",
    machine: "WCTL-2",
    tonnage: 195.30,
    coils: 7,
    delays: [{ time: 80, type: "MAINTENANCE BREAKDOWN", description: "Tension leveler card replacement" }]
  },
  {
    date: "17.05.2026",
    shift: "A",
    incharge: "DIGANTA SAHU",
    team: "Debasis & Team",
    machine: "WCTL-2",
    tonnage: 228.60,
    coils: 10,
    delays: [{ time: 10, type: "SHIFT HANDOVER", description: "Smooth handover" }]
  },
  // SLITTER Mock Dataset
  {
    date: "09.05.2026",
    shift: "B",
    incharge: "SUNIL PRADHAN",
    team: "Ranjeet & Team",
    machine: "SLITTER",
    tonnage: 112.40,
    coils: 25,
    delays: [{ time: 75, type: "MAINTENANCE BREAKDOWN", description: "Mandrel expansion cylinder leak" }]
  },
  {
    date: "13.05.2026",
    shift: "A",
    incharge: "DIGANTA SAHU",
    team: "Debasis & Team",
    machine: "SLITTER",
    tonnage: 132.80,
    coils: 30,
    delays: [{ time: 15, type: "SCRAP REMOVAL", description: "Chute jam" }]
  },
  {
    date: "16.05.2026",
    shift: "C",
    incharge: "RAHUL KUMAR",
    team: "Anurag & Team",
    machine: "SLITTER",
    tonnage: 124.90,
    coils: 28,
    delays: [{ time: 50, type: "MAINTENANCE BREAKDOWN", description: "Recoiler brake coil failure" }]
  }
];
