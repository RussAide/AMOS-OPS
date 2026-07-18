export function evaluateQuizCompletion(
  finalScore: number,
  totalQuestions: number,
  passingScore: number,
): { score: number; passed: boolean } {
  const percentage =
    totalQuestions > 0 ? Math.round((finalScore / totalQuestions) * 100) : 0;
  return { score: finalScore, passed: percentage >= passingScore };
}
