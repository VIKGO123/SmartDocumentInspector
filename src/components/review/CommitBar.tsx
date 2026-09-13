"use client";

interface Props {
  unresolvedLow: number;
  missingRequired: number;
  onCommit: () => void;
  committing?: boolean;
}

export function CommitBar({
  unresolvedLow,
  missingRequired,
  onCommit,
  committing,
}: Props) {
  const blocked = unresolvedLow + missingRequired;
  const disabled = blocked > 0 || committing;
  let message = "Ready to commit — JSON is the export contract.";
  if (missingRequired > 0) {
    message = `${missingRequired} required field${missingRequired === 1 ? "" : "s"} still empty.`;
  } else if (unresolvedLow > 0) {
    message = `${unresolvedLow} field${unresolvedLow === 1 ? "" : "s"} need review before you can commit.`;
  }
  return (
    <div className="commit-bar">
      <span>{message}</span>
      <button type="button" disabled={disabled} onClick={onCommit}>
        Commit
      </button>
    </div>
  );
}
