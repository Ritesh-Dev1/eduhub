import { SubjectUnitsClient } from "./subject-units-client";

interface PageProps {
  params: Promise<{ name: string }>;
}

export default async function SubjectUnitsPage({ params }: PageProps) {
  const { name } = await params;
  return <SubjectUnitsClient subjectName={name} />;
}
