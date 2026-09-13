"use client";

import { useDropzone } from "react-dropzone";
import { ALLOWED_EXTENSIONS } from "@/lib/pipeline/fileSniff";

interface Props {
  compact: boolean;
  onFiles: (files: File[]) => void;
}

export function Dropzone({ compact, onFiles }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    onDrop: (files) => {
      if (files && files.length > 0) {
        onFiles(files);
      }
    },
  });

  return (
    <div
      {...getRootProps({
        className: `dropzone ${compact ? "is-compact" : "is-empty"} ${isDragActive ? "is-active" : ""}`,
      })}
    >
      <input {...getInputProps()} data-testid="file-input" />
      <div>
        <h2>Drop a document to inspect it</h2>
        <p className="muted">{ALLOWED_EXTENSIONS}</p>
      </div>
    </div>
  );
}
