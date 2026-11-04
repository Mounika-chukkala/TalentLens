
export interface ParsedResume {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  warnings: string[];
}

const KNOWN_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C",
  "C++",
  "C#",
  "SQL",
  "HTML",
  "CSS",
  "React",
  "React.js",
  "Redux",
  "Node.js",
  "Express.js",
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "Redis",
  "Tailwind CSS",
  "Bootstrap",
  "REST APIs",
  "Git",
  "GitHub",
  "Linux",
  "AWS",
  "Docker",
  "Kubernetes",
  "Machine Learning",
  "Deep Learning",
  "Generative AI",
  "LLMs",
  "Flask",
  "Django",
  "Spring Boot",
  "WebSockets",
];

function extractEmail(text: string): string | null {
  const match = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );

  return match ? match[0].toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const lines = text.split(/\r?\n/);

  for (const line of lines.slice(0, 12)) {
    const match = line.match(
      /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)\d{5,8}/,
    );

    if (match) {
      const digits = match[0].replace(/\D/g, "");

      if (digits.length >= 10 && digits.length <= 13) {
        return match[0].trim();
      }
    }
  }

  return null;
}

function extractName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[#\s]+/, "").trim())
    .filter(Boolean);

  const firstLine = lines[0];

  if (
    !firstLine ||
    firstLine.length > 80 ||
    /@|resume|curriculum vitae|phone|email/i.test(firstLine) ||
    /\d/.test(firstLine)
  ) {
    return null;
  }

  const words = firstLine.split(/\s+/);

  if (words.length < 2 || words.length > 5) {
    return null;
  }

  return firstLine;
}

function extractSkills(text: string): string[] {
  const normalizedText = text.toLowerCase();
  const found = new Set<string>();

  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^a-z0-9+#.])${escaped.toLowerCase()}($|[^a-z0-9+#.])`, "i");

    if (pattern.test(normalizedText)) {
      found.add(skill);
    }
  }

  return [...found];
}

export function parseResume(text: string): ParsedResume {
  const fullName = extractName(text);
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const skills = extractSkills(text);
  const warnings: string[] = [];

  if (!fullName) {
    warnings.push("Could not confidently identify the candidate's name.");
  }

  if (!email) {
    warnings.push("No email address was detected.");
  }

  if (!phone) {
    warnings.push("No phone number was detected.");
  }

  if (skills.length === 0) {
    warnings.push("No recognized skills were detected.");
  }

  return {
    fullName,
    email,
    phone,
    skills,
    warnings,
  };
}
