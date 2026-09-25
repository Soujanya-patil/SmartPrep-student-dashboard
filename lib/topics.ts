export interface Topic {
  subject: "Physics" | "Chemistry" | "Maths" | "Biology"
  chapter: string
}

export const NEET_TOPICS: Topic[] = [
  // ==================== BIOLOGY ====================
  { subject: "Biology", chapter: "Cell Division" },
  { subject: "Biology", chapter: "Cell Cycle" },
  { subject: "Biology", chapter: "Cell Membrane" },
  { subject: "Biology", chapter: "Cell Structure" },
  { subject: "Biology", chapter: "Cellular Respiration" },
  { subject: "Biology", chapter: "Photosynthesis" },
  { subject: "Biology", chapter: "Mitosis" },
  { subject: "Biology", chapter: "Meiosis" },
  { subject: "Biology", chapter: "DNA Replication" },
  { subject: "Biology", chapter: "Transcription" },
  { subject: "Biology", chapter: "Translation" },
  { subject: "Biology", chapter: "Genetics" },
  { subject: "Biology", chapter: "Mendelian Inheritance" },
  { subject: "Biology", chapter: "Human Genetics" },
  { subject: "Biology", chapter: "Evolution" },
  { subject: "Biology", chapter: "Natural Selection" },
  { subject: "Biology", chapter: "Human Digestive System" },
  { subject: "Biology", chapter: "Human Respiratory System" },
  { subject: "Biology", chapter: "Human Circulatory System" },
  { subject: "Biology", chapter: "Human Nervous System" },
  { subject: "Biology", chapter: "Human Endocrine System" },
  { subject: "Biology", chapter: "Human Reproductive System" },
  { subject: "Biology", chapter: "Neural Control" },
  { subject: "Biology", chapter: "Plant Kingdom" },
  { subject: "Biology", chapter: "Animal Kingdom" },
  { subject: "Biology", chapter: "Biomolecules" },
  { subject: "Biology", chapter: "Enzymes" },
  { subject: "Biology", chapter: "Ecosystem" },
  { subject: "Biology", chapter: "Biodiversity" },
  { subject: "Biology", chapter: "Biotechnology" },
  { subject: "Biology", chapter: "Immunology" },
  { subject: "Biology", chapter: "Human Health and Disease" },

  // ==================== PHYSICS ====================
  { subject: "Physics", chapter: "Newton's Laws of Motion" },
  { subject: "Physics", chapter: "Kinematics" },
  { subject: "Physics", chapter: "Work Energy Power" },
  { subject: "Physics", chapter: "Rotational Motion" },
  { subject: "Physics", chapter: "Gravitation" },
  { subject: "Physics", chapter: "Thermodynamics" },
  { subject: "Physics", chapter: "Kinetic Theory of Gases" },
  { subject: "Physics", chapter: "Oscillations" },
  { subject: "Physics", chapter: "Waves" },
  { subject: "Physics", chapter: "Electrostatics" },
  { subject: "Physics", chapter: "Current Electricity" },
  { subject: "Physics", chapter: "Magnetic Effects of Current" },
  { subject: "Physics", chapter: "Electromagnetic Induction" },
  { subject: "Physics", chapter: "Alternating Current" },
  { subject: "Physics", chapter: "Ray Optics" },
  { subject: "Physics", chapter: "Wave Optics" },
  { subject: "Physics", chapter: "Modern Physics" },
  { subject: "Physics", chapter: "Photoelectric Effect" },
  { subject: "Physics", chapter: "Atomic Structure" },
  { subject: "Physics", chapter: "Nuclear Physics" },
  { subject: "Physics", chapter: "Semiconductors" },
  { subject: "Physics", chapter: "Units and Measurements" },
  { subject: "Physics", chapter: "Motion in a Straight Line" },
  { subject: "Physics", chapter: "Motion in a Plane" },
  { subject: "Physics", chapter: "Laws of Motion" },
  { subject: "Physics", chapter: "System of Particles" },
  { subject: "Physics", chapter: "Mechanical Properties of Solids" },
  { subject: "Physics", chapter: "Mechanical Properties of Fluids" },
  { subject: "Physics", chapter: "Thermal Properties of Matter" },

  // ==================== CHEMISTRY ====================
  { subject: "Chemistry", chapter: "Atomic Structure" },
  { subject: "Chemistry", chapter: "Chemical Bonding" },
  { subject: "Chemistry", chapter: "Periodic Table" },
  { subject: "Chemistry", chapter: "States of Matter" },
  { subject: "Chemistry", chapter: "Thermodynamics" },
  { subject: "Chemistry", chapter: "Equilibrium" },
  { subject: "Chemistry", chapter: "Redox Reactions" },
  { subject: "Chemistry", chapter: "Electrochemistry" },
  { subject: "Chemistry", chapter: "Chemical Kinetics" },
  { subject: "Chemistry", chapter: "Solutions" },
  { subject: "Chemistry", chapter: "Organic Chemistry Basics" },
  { subject: "Chemistry", chapter: "Hydrocarbons" },
  { subject: "Chemistry", chapter: "Haloalkanes" },
  { subject: "Chemistry", chapter: "Alcohols Phenols Ethers" },
  { subject: "Chemistry", chapter: "Aldehydes Ketones" },
  { subject: "Chemistry", chapter: "Carboxylic Acids" },
  { subject: "Chemistry", chapter: "Amines" },
  { subject: "Chemistry", chapter: "Biomolecules" },
  { subject: "Chemistry", chapter: "Polymers" },
  { subject: "Chemistry", chapter: "Coordination Compounds" },
  { subject: "Chemistry", chapter: "d and f Block Elements" },
  { subject: "Chemistry", chapter: "p Block Elements" },
  { subject: "Chemistry", chapter: "s Block Elements" },
  { subject: "Chemistry", chapter: "Metallurgy" },
  { subject: "Chemistry", chapter: "Surface Chemistry" },
  { subject: "Chemistry", chapter: "Solid State" },
  { subject: "Chemistry", chapter: "Nuclear Chemistry" },

  // ==================== MATHS ====================
  { subject: "Maths", chapter: "Sets Relations Functions" },
  { subject: "Maths", chapter: "Trigonometric Functions" },
  { subject: "Maths", chapter: "Inverse Trigonometric Functions" },
  { subject: "Maths", chapter: "Complex Numbers" },
  { subject: "Maths", chapter: "Quadratic Equations" },
  { subject: "Maths", chapter: "Sequences and Series" },
  { subject: "Maths", chapter: "Binomial Theorem" },
  { subject: "Maths", chapter: "Permutations and Combinations" },
  { subject: "Maths", chapter: "Mathematical Induction" },
  { subject: "Maths", chapter: "Straight Lines" },
  { subject: "Maths", chapter: "Conic Sections" },
  { subject: "Maths", chapter: "Circles" },
  { subject: "Maths", chapter: "Parabola" },
  { subject: "Maths", chapter: "Ellipse" },
  { subject: "Maths", chapter: "Hyperbola" },
  { subject: "Maths", chapter: "Limits and Derivatives" },
  { subject: "Maths", chapter: "Continuity and Differentiability" },
  { subject: "Maths", chapter: "Applications of Derivatives" },
  { subject: "Maths", chapter: "Integrals" },
  { subject: "Maths", chapter: "Definite Integrals" },
  { subject: "Maths", chapter: "Applications of Integrals" },
  { subject: "Maths", chapter: "Differential Equations" },
  { subject: "Maths", chapter: "Vectors" },
  { subject: "Maths", chapter: "Three Dimensional Geometry" },
  { subject: "Maths", chapter: "Linear Programming" },
  { subject: "Maths", chapter: "Probability" },
  { subject: "Maths", chapter: "Statistics" },
  { subject: "Maths", chapter: "Matrices" },
  { subject: "Maths", chapter: "Determinants" },
  { subject: "Maths", chapter: "Relations and Functions" },
]

/**
 * Filter topics by partial match on chapter name and optional subject.
 * Returns up to 8 suggestions.
 */
export function suggestTopics(query: string, subject?: string): Topic[] {
  if (!query || query.trim().length < 1) return []

  const q = query.toLowerCase().trim()

  return NEET_TOPICS
    .filter((t) => {
      const matchesQuery = t.chapter.toLowerCase().includes(q)
      const matchesSubject =
        !subject || subject === "All" || t.subject === subject
      return matchesQuery && matchesSubject
    })
    .sort((a, b) => {
      // Prefer chapters that START with the query
      const aStarts = a.chapter.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.chapter.toLowerCase().startsWith(q) ? 0 : 1
      return aStarts - bStarts
    })
    .slice(0, 8)
}