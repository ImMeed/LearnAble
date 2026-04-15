import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { FocusTimerCard } from "./FocusTimerCard";
import { FocusTimerMini } from "./FocusTimerMini";
import { useFocusTimerState } from "./FocusTimerContext";
import { useDraggableSnap } from "../attention/hooks/useDraggableSnap";

const WIDGET_WIDTH = 360;
const WIDGET_HEIGHT = 420;
const MINI_WIDTH = 170;
const MINI_HEIGHT = 52;

export function FocusTimerPortal() {
  const { t } = useTranslation();
  const {
    state,
    isActive,
    setPosition,
    setMinimized,
    cancel,
    markDragged,
  } = useFocusTimerState();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const { dragPos, isDragging, widgetRef, onDragHandleMouseDown } = useDraggableSnap("bottom-right");
  const miniGestureRef = useRef<{ startX: number; startY: number; active: boolean; dragged: boolean } | null>(null);
  const suppressMiniExpandRef = useRef(false);

  const size = useMemo(
    () => (state.isMinimized ? { width: MINI_WIDTH, height: MINI_HEIGHT } : { width: WIDGET_WIDTH, height: WIDGET_HEIGHT }),
    [state.isMinimized],
  );

  useEffect(() => {
    if (isDragging && dragPos) {
      setPosition(dragPos);
    }
  }, [dragPos, isDragging, setPosition]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const gesture = miniGestureRef.current;
      if (!gesture || !gesture.active) {
        return;
      }

      const movedX = Math.abs(event.clientX - gesture.startX);
      const movedY = Math.abs(event.clientY - gesture.startY);
      if (movedX > 6 || movedY > 6) {
        gesture.dragged = true;
      }
    };

    const onMouseUp = () => {
      const gesture = miniGestureRef.current;
      if (!gesture || !gesture.active) {
        return;
      }

      suppressMiniExpandRef.current = gesture.dragged;
      gesture.active = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (!isActive) {
    return null;
  }

  const style: CSSProperties = {
    position: "fixed",
    left: state.position.x,
    top: state.position.y,
    width: size.width,
    zIndex: 45,
  };

  const beginDrag = (event: React.MouseEvent) => {
    markDragged();
    onDragHandleMouseDown(event);
  };

  const beginMiniDrag = (event: React.MouseEvent) => {
    suppressMiniExpandRef.current = false;
    miniGestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      active: true,
      dragged: false,
    };
    beginDrag(event);
  };

  const onMiniExpand = () => {
    if (suppressMiniExpandRef.current) {
      suppressMiniExpandRef.current = false;
      return;
    }

    setMinimized(false);
  };

  const onConfirmCancel = () => {
    cancel();
    setConfirmOpen(false);
  };

  return createPortal(
    <div ref={widgetRef} className="focus-floating-root" style={style}>
      {state.isMinimized ? (
        <div className="focus-floating-shell" onMouseDown={beginMiniDrag}>
          <FocusTimerMini onExpand={onMiniExpand} />
        </div>
      ) : (
        <div className="focus-floating-shell focus-floating-shell--card">
          <div className="focus-floating-drag" onMouseDown={beginDrag} title={t("timer.widget.dragToMove")}>⠿</div>
          <FocusTimerCard
            compact
            onRequestMinimize={() => setMinimized(true)}
            onRequestCancel={() => setConfirmOpen(true)}
          />
        </div>
      )}

      {confirmOpen ? (
        <div className="focus-floating-confirm" role="dialog" aria-modal="true" aria-label={t("timer.widget.cancelConfirmTitle")}>
          <p>{t("timer.widget.cancelConfirmTitle")}</p>
          <div className="focus-floating-confirm-actions">
            <button type="button" className="focus-pomodoro-pill" onClick={() => setConfirmOpen(false)}>
              {t("timer.widget.cancelKeep")}
            </button>
            <button type="button" className="focus-pomodoro-primary" onClick={onConfirmCancel}>
              {t("timer.widget.cancelStop")}
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
