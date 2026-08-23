import React, { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewQuestion } from "@/config/reviewCompetencies";

interface Props {
  questions: ReviewQuestion[];
  values: Record<string, string>;
  readOnly?: boolean;
  onSave: (key: string, answer: string | null) => void;
}

const QuestionItem: React.FC<{
  question: ReviewQuestion;
  value: string;
  readOnly?: boolean;
  onSave: (answer: string | null) => void;
}> = ({ question, value, readOnly, onSave }) => {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{question.label}</label>
      {readOnly ? (
        <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm">
          {value || <span className="text-muted-foreground">No answer given</span>}
        </p>
      ) : (
        <Textarea
          className="min-h-[70px] text-sm"
          placeholder={question.placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => onSave(text.trim() || null)}
        />
      )}
    </div>
  );
};

const QuestionList: React.FC<Props> = ({ questions, values, readOnly, onSave }) => (
  <div className="space-y-4">
    {questions.map(q => (
      <QuestionItem
        key={q.key}
        question={q}
        value={values[q.key] ?? ""}
        readOnly={readOnly}
        onSave={answer => onSave(q.key, answer)}
      />
    ))}
  </div>
);

export default QuestionList;
