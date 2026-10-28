"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Clock, CheckCircle2, X } from "lucide-react";
import type { NoteItem } from "@/app/actions/notes";

interface DownloadDialogProps {
  note: NoteItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (note: NoteItem) => void;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DownloadDialog({
  note,
  isOpen,
  onClose,
  onDownload,
}: DownloadDialogProps) {
  const [countdown, setCountdown] = useState(5);
  const [adHeight, setAdHeight] = useState(250);

  // Listen for dynamic resize messages from the native ad iframe
  useEffect(() => {
    function handleMsg(e: MessageEvent) {
      if (
        e.data &&
        e.data.type === "AD_RESIZE" &&
        typeof e.data.height === "number" &&
        e.data.height > 50
      ) {
        setAdHeight(e.data.height);
      }
    }
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, []);

  useEffect(() => {
    if (!isOpen || !note) {
      setCountdown(5);
      return;
    }

    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, note]);

  if (!isOpen || !note) return null;

  const adFrameSrc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: auto;
      min-height: 100%;
      overflow: visible;
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    #container-e0a941ced58f18528293f17c42f9cc54 {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div id="container-e0a941ced58f18528293f17c42f9cc54"></div>
  <script async="async" data-cfasync="false" src="https://pl32061952.profitableratecpmnetwork.com/e0a941ced58f18528293f17c42f9cc54/invoke.js"></script>
  <script>
    function notifySize() {
      var h = Math.max(
        document.body.scrollHeight || 0,
        document.documentElement.scrollHeight || 0,
        document.body.offsetHeight || 0
      );
      if (h > 50) {
        window.parent.postMessage({ type: 'AD_RESIZE', height: h }, '*');
      }
    }
    window.addEventListener('load', notifySize);
    window.addEventListener('resize', notifySize);
    if (window.MutationObserver) {
      var obs = new MutationObserver(notifySize);
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
    setInterval(notifySize, 400);
  </script>
</body>
</html>`;

  return (
    <div
      className="soft-modal-overlay p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-modal-title"
    >
      <div
        className="soft-modal-content max-w-lg sm:max-w-xl w-full p-6 sm:p-7 space-y-4 relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--mute)] hover:text-[var(--ink)] w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
          style={{ background: "var(--bg)", boxShadow: "var(--raise-s)" }}
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Note Information Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="ico shrink-0 text-red-500">
            <FileText className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span
              className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1"
              style={{ boxShadow: "var(--press)", color: "var(--acc)" }}
            >
              {note.subject}
            </span>
            <h3
              id="download-modal-title"
              className="font-extrabold text-[var(--ink)] text-base line-clamp-2 leading-snug"
            >
              {note.title}
            </h3>
            <p className="text-xs text-[var(--mute)] mt-0.5 font-medium">
              PDF Document &bull; {formatBytes(note.file_size)}
            </p>
          </div>
        </div>

        {/* Native Ad Container - Expands dynamically to 100% of native ad height */}
        <div
          className="w-full rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center transition-all"
          style={{
            background: "var(--bg)",
            boxShadow: "var(--press)",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mute)] opacity-50 mb-1">
            Sponsored
          </span>
          <iframe
            srcDoc={adFrameSrc}
            className="w-full border-0 transition-all duration-300"
            style={{
              height: `${adHeight}px`,
              minHeight: "140px",
              display: "block",
            }}
            title="Sponsored Announcement"
            scrolling="auto"
          />
          {/* Direct native container */}
          <div id="container-e0a941ced58f18528293f17c42f9cc54" className="w-full flex justify-center empty:hidden" />
        </div>

        {/* Countdown & Status Display */}
        <div className="text-center py-1">
          {countdown > 0 ? (
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mute)]">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-black text-[var(--acc)]"
                style={{ boxShadow: "var(--press)", background: "var(--bg)" }}
              >
                {countdown}
              </span>
              <span>Preparing secure download link... ({countdown}s)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Your official curriculum PDF is ready!</span>
            </div>
          )}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--lo)]">
          <button
            type="button"
            className="btn text-xs font-bold cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>

          {countdown > 0 ? (
            <button
              disabled
              className="btn text-xs font-bold cursor-not-allowed opacity-60 inline-flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Please wait {countdown}s</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn pri text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 animate-pulse"
              onClick={() => {
                onDownload(note);
                onClose();
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
