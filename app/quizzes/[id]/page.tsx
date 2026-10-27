import { PublicHeader } from "@/components/public-header";
import { QuizClient } from "./quiz-client";

interface QuizPageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentQuizPage({ params }: QuizPageProps) {
  const resolvedParams = await params;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PublicHeader />
      <div className="flex-1 flex flex-col">
        <QuizClient quizId={resolvedParams.id} />
      </div>
    </div>
  );
}
