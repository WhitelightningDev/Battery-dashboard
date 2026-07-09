import { useEffect, useRef, useState } from "react";
import { createRun, getRun } from "../api";
import type { RunResponse } from "../types";

interface RunLauncherProps {
  onComplete: () => void;
}

const POLL_INTERVAL_MS = 700;

/** Own the optional run lifecycle without coupling it to pricing state. */
export function RunLauncher({ onComplete }: RunLauncherProps) {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launchController = useRef<AbortController | null>(null);
  const isPending =
    run?.status === "queued" || run?.status === "running";

  useEffect(() => {
    // Schedule one poll at a time; each response drives the next render and poll.
    if (!isPending || !run) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void getRun(run.id, controller.signal)
        .then((nextRun) => {
          if (controller.signal.aborted) {
            return;
          }

          setRun(nextRun);
          setError(null);

          if (nextRun.status === "complete") {
            // Completion is the only integration point with the pricing flow.
            onComplete();
          }
        })
        .catch((pollError: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          // Return to a launchable state instead of trapping the disabled button.
          setRun(null);
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Unable to retrieve run status.",
          );
        });
    }, POLL_INTERVAL_MS);

    return () => {
      // Selection changes and unmounts must not leave timers or requests active.
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isPending, onComplete, run]);

  useEffect(
    () => () => {
      launchController.current?.abort();
    },
    [],
  );

  /** Create a run while preventing overlapping launch requests. */
  async function handleLaunch(): Promise<void> {
    // Defensive cancellation prevents overlapping create requests.
    launchController.current?.abort();
    const controller = new AbortController();
    launchController.current = controller;
    setIsLaunching(true);
    setError(null);

    try {
      const createdRun = await createRun(controller.signal);

      if (!controller.signal.aborted) {
        setRun(createdRun);
      }
    } catch (launchError: unknown) {
      if (!controller.signal.aborted) {
        setError(
          launchError instanceof Error
            ? launchError.message
            : "Unable to launch run.",
        );
      }
    } finally {
      if (launchController.current === controller) {
        launchController.current = null;

        if (!controller.signal.aborted) {
          setIsLaunching(false);
        }
      }
    }
  }

  const buttonLabel = isLaunching
    ? "Launching…"
    : isPending
      ? "Run in progress"
      : run?.status === "complete"
        ? "Launch another run"
        : "Launch Run";

  return (
    <section className="run-launcher" aria-labelledby="run-launcher-title">
      <div>
        <p className="eyebrow">Optional workflow</p>
        <h2 id="run-launcher-title">Pricing run</h2>
        <p>Launch a simulated run and refresh pricing when it completes.</p>
      </div>

      <div className="run-actions">
        <button
          className="launch-button"
          type="button"
          disabled={isLaunching || isPending}
          onClick={() => void handleLaunch()}
        >
          {buttonLabel}
        </button>

        <div
          className="run-status"
          aria-live="polite"
          aria-busy={isLaunching || isPending}
        >
          {run && (
            <span className={`run-status-${run.status}`}>
              Status: {run.status}
            </span>
          )}
          {error && (
            <span className="run-status-error" role="alert">
              {error}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
