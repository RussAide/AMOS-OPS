import { useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { QuizQuestion } from "@/data/onboardingData";

interface QuizEngineProps {
  questions: QuizQuestion[];
  moduleTitle: string;
  passingScore?: number;
  onComplete?: (score: number, total: number, passed: boolean) => void;
  onCancel?: () => void;
}

export function QuizEngine({
  questions,
  passingScore = 80,
  onComplete,
  onCancel,
}: QuizEngineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<
    { questionId: string; selectedIndex: number; correct: boolean }[]
  >([]);
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const isCorrect = selectedAnswer === currentQuestion?.correctIndex;
  const pctCorrect = Math.round((score / totalQuestions) * 100);
  const passed = pctCorrect >= passingScore;

  const handleSelect = useCallback(
    (index: number) => {
      if (showFeedback) return;
      setSelectedAnswer(index);
      setShowFeedback(true);

      const correct = index === currentQuestion.correctIndex;
      if (correct) {
        setScore((prev) => prev + 1);
      }
      setAnswers((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          selectedIndex: index,
          correct,
        },
      ]);
    },
    [showFeedback, currentQuestion]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setIsFinished(true);
      const finalScore = score + (isCorrect ? 1 : 0);
      onComplete?.(finalScore, totalQuestions, passed);
    }
  }, [currentIndex, totalQuestions, score, isCorrect, passed, onComplete]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setScore(0);
    setAnswers([]);
    setIsFinished(false);
  }, []);

  // Results screen
  if (isFinished) {
    return (
      <div className="space-y-5">
        {/* Score Header */}
        <div
          className="rounded-lg border p-6 text-center"
          style={{
            borderColor: passed ? "#059669" : "#D97706",
            backgroundColor: passed ? "#ECFDF5" : "#FFFBEB",
          }}
        >
          {passed ? (
            <Trophy size={40} style={{ color: "#059669" }} className="mx-auto mb-3" />
          ) : (
            <AlertTriangle size={40} style={{ color: "#D97706" }} className="mx-auto mb-3" />
          )}
          <h3
            className="text-[20px] font-bold mb-1"
            style={{ color: passed ? "#065F46" : "#92400E" }}
          >
            {passed ? "Module Assessment Passed" : "Assessment Not Passed"}
          </h3>
          <p className="text-[14px] mb-3" style={{ color: passed ? "#065F46" : "#92400E" }}>
            {passed
              ? `Congratulations! You scored ${pctCorrect}% and have successfully completed this module.`
              : `You scored ${pctCorrect}%. A score of ${passingScore}% is required to pass. Review the explanations below and try again.`}
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <p className="text-[28px] font-bold" style={{ color: passed ? "#059669" : "#D97706" }}>
                {score}/{totalQuestions}
              </p>
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                Correct
              </p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <p className="text-[28px] font-bold" style={{ color: passed ? "#059669" : "#D97706" }}>
                {pctCorrect}%
              </p>
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                Score
              </p>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="text-center">
              <p className="text-[28px] font-bold" style={{ color: "#245C5A" }}>
                {passingScore}%
              </p>
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                Required
              </p>
            </div>
          </div>
        </div>

        {/* Answer Review */}
        <div className="space-y-3">
          <h4 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            Answer Review
          </h4>
          {questions.map((q, i) => {
            const answer = answers[i];
            const wasCorrect = answer?.correct;
            return (
              <div
                key={q.id}
                className="rounded-lg border p-4"
                style={{
                  borderColor: wasCorrect ? "#059669" : "#DC2626",
                  backgroundColor: wasCorrect ? "#ECFDF5" : "#FEE2E2",
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  {wasCorrect ? (
                    <CheckCircle size={18} style={{ color: "#059669" }} className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={18} style={{ color: "#DC2626" }} className="flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                      {i + 1}. {q.question}
                    </p>
                    {!wasCorrect && (
                      <p className="text-[12px] mt-1" style={{ color: "#991B1B" }}>
                        Your answer: {q.options[answer?.selectedIndex ?? 0]}
                      </p>
                    )}
                    <p className="text-[12px] mt-1 font-medium" style={{ color: wasCorrect ? "#065F46" : "#065F46" }}>
                      Correct answer: {q.options[q.correctIndex]}
                    </p>
                    <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
                      {q.explanation}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!passed && (
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all hover:shadow-md"
              style={{ backgroundColor: "#245C5A" }}
            >
              <RotateCcw size={15} />
              Retake Assessment
            </button>
          )}
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium border transition-all hover:shadow-sm"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
          >
            Back to Module
          </button>
        </div>
      </div>
    );
  }

  // Quiz question screen
  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${((currentIndex) / totalQuestions) * 100}%`,
                backgroundColor: "#245C5A",
              }}
            />
          </div>
          <span className="text-[12px] font-medium flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>
            {currentIndex + 1} of {totalQuestions}
          </span>
        </div>
        <span className="text-[12px] font-medium ml-3 flex-shrink-0" style={{ color: "#245C5A" }}>
          Score: {score}/{currentIndex}
        </span>
      </div>

      {/* Question */}
      <h3
        className="text-[18px] font-bold mb-4"
        style={{ color: "var(--topbar-title)" }}
      >
        {currentQuestion.question}
      </h3>

      {/* Options */}
      <div className="space-y-2 mb-5">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectOption = index === currentQuestion.correctIndex;

          let borderColor = "var(--card-border)";
          let bgColor = "var(--card-bg)";
          let icon = null;

          if (showFeedback) {
            if (isCorrectOption) {
              borderColor = "#059669";
              bgColor = "#ECFDF5";
              icon = <CheckCircle size={18} style={{ color: "#059669" }} className="flex-shrink-0" />;
            } else if (isSelected && !isCorrectOption) {
              borderColor = "#DC2626";
              bgColor = "#FEE2E2";
              icon = <XCircle size={18} style={{ color: "#DC2626" }} className="flex-shrink-0" />;
            } else {
              borderColor = "#E2E8F0";
              bgColor = "#F8FAFB";
            }
          } else if (isSelected) {
            borderColor = "#245C5A";
            bgColor = "#F0FDFA";
          }

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showFeedback}
              className="w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all duration-150"
              style={{
                borderColor,
                backgroundColor: bgColor,
                cursor: showFeedback ? "default" : "pointer",
                opacity: showFeedback && !isSelected && !isCorrectOption ? 0.5 : 1,
              }}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                style={{
                  backgroundColor: isSelected || (showFeedback && isCorrectOption) ? (isCorrectOption ? "#059669" : isSelected ? "#245C5A" : "#E2E8F0") : "#F1F5F9",
                  color: isSelected || (showFeedback && isCorrectOption) ? "#fff" : "#64748B",
                }}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span className="text-[14px] flex-1" style={{ color: "var(--topbar-title)" }}>
                {option}
              </span>
              {icon}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {showFeedback && (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{
            borderColor: isCorrect ? "#059669" : "#DC2626",
            backgroundColor: isCorrect ? "#ECFDF5" : "#FEE2E2",
          }}
        >
          <p
            className="text-[14px] font-semibold mb-1"
            style={{ color: isCorrect ? "#065F46" : "#991B1B" }}
          >
            {isCorrect ? "Correct!" : "Incorrect"}
          </p>
          <p className="text-[13px]" style={{ color: isCorrect ? "#065F46" : "#991B1B" }}>
            {currentQuestion.explanation}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-all"
          style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}
        >
          Cancel
        </button>
        {showFeedback && (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all hover:shadow-md"
            style={{ backgroundColor: "#245C5A" }}
          >
            {currentIndex < totalQuestions - 1 ? "Next Question" : "View Results"}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
