import { JSX, ComponentChildren } from "preact";
import { hydrate, prerender as ssr } from "preact-iso";
import { useState, useRef, useEffect } from "preact/hooks";
import {
  addMinutes,
  format,
  isSameDay,
  isTomorrow,
  isYesterday,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

import "./style.css";

export function App() {
  return (
    <>
      <SVGSprites />
      <WorldClockSlider />
    </>
  );
}

function WorldClockSlider() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(new Date());
  const [offsetMinutes, setOffsetMinutes] = useState(0);
  const [sliderX, setSliderX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const localTime = addMinutes(now, offsetMinutes);
  const timeBound = 1440; // minutes
  const isRTL = useRTL();
  const cities: City[] = [
    { name: "Portland", timeZone: "America/Los_Angeles" },
    { name: "New York", timeZone: "America/New_York" },
    { name: "Reykjavik", timeZone: "Atlantic/Reykjavik" },
    { name: "London", timeZone: "Europe/London" },
    { name: "Helsinki", timeZone: "Europe/Helsinki" },
    { name: "Singapore", timeZone: "Asia/Singapore" },
  ];

  function useRTL(defaultRTL = false) {
    const [isRTL, setIsRTL] = useState(defaultRTL);

    useEffect(() => {
      const detected =
        document.dir === "rtl" || document.documentElement.dir === "rtl";
      setIsRTL(detected);
    }, []);

    return isRTL;
  }

  function handleMouseDown(
    event:
      | JSX.TargetedMouseEvent<HTMLDivElement>
      | JSX.TargetedTouchEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    if (isResetting) return;

    setDragging(true);
    setShowTooltip(true);
  }

  function handleMouseMove(event: MouseEvent | TouchEvent) {
    if (isResetting || !dragging || !containerRef.current) return;

    const clientX =
      "touches" in event ? event.touches[0].clientX : event.clientX;
    const { left, width } = containerRef.current.getBoundingClientRect();
    // clamp X to container bounds
    const clampedX = Math.max(0, Math.min(clientX - left, width));
    const clampedOffset = Math.max(
      -timeBound,
      Math.min(
        timeBound,
        Utils.getOffsetFromSliderX(clampedX, width, timeBound)
      )
    );

    setOffsetMinutes(isRTL ? -clampedOffset : clampedOffset);
    setSliderX(Utils.getSliderXFromOffset(clampedOffset, width, timeBound));
  }

  function handleKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (isResetting || !containerRef.current) return;

    const step = 30; // minutes
    const { width } = containerRef.current.getBoundingClientRect();
    const { key } = event;
    const isHome = key === "Home";
    const isEnd = key === "End";
    const towardEnd = key === "ArrowUp" || key === "ArrowRight";
    const towardStart = key === "ArrowDown" || key === "ArrowLeft";
    let newOffset = offsetMinutes;

    if (isHome) {
      newOffset = -timeBound;
    } else if (isEnd) {
      newOffset = timeBound;
    } else if (towardEnd) {
      newOffset = Math.min(timeBound, offsetMinutes + step);
    } else if (towardStart) {
      newOffset = Math.max(-timeBound, offsetMinutes - step);
    } else {
      return;
    }

    event.preventDefault();
    setOffsetMinutes(newOffset);
    setSliderX(
      Utils.getSliderXFromOffset(
        isRTL ? -newOffset : newOffset,
        width,
        timeBound
      )
    );
    setShowTooltip(true);
  }

  function handleContainerClick(
    event:
      | JSX.TargetedMouseEvent<EventTarget>
      | JSX.TargetedTouchEvent<EventTarget>
  ) {
    const target = event.target as HTMLElement;

    if (isResetting || target.closest("[data-close]") || !containerRef.current)
      return;

    const { left, width } = containerRef.current.getBoundingClientRect();
    const clientX =
      "touches" in event ? event.touches[0].clientX : event.clientX;
    const x = Math.max(0, Math.min(clientX - left, width));
    const newOffset = Utils.getOffsetFromSliderX(x, width, timeBound);
    const clampedOffset = Math.max(-timeBound, Math.min(timeBound, newOffset));

    setOffsetMinutes(isRTL ? -clampedOffset : clampedOffset);
    setSliderX(Utils.getSliderXFromOffset(clampedOffset, width, timeBound));
    setShowTooltip(true);
    setDragging(true);
  }

  function refreshSlider() {
    if (!containerRef.current) return;

    const { width } = containerRef.current.getBoundingClientRect();

    setSliderX(Utils.getSliderXFromOffset(offsetMinutes, width, timeBound));
  }

  function resetSlider() {
    if (isResetting || !containerRef.current) return;

    setIsResetting(true);

    const { width } = containerRef.current.getBoundingClientRect();
    const fromOffset = offsetMinutes;
    const fromSliderX =
      sliderX ?? Utils.getSliderXFromOffset(offsetMinutes, width, timeBound);
    const targetOffset = 0;
    const targetSliderX = Utils.getSliderXFromOffset(
      targetOffset,
      width,
      timeBound
    );
    const duration = 300;

    Utils.animateValue(
      fromOffset,
      targetOffset,
      duration,
      (val) => setOffsetMinutes(Math.round(val)),
      () => {
        setIsResetting(false);
        setOffsetMinutes(targetOffset);
        setShowTooltip(false);
      }
    );
    Utils.animateValue(
      fromSliderX,
      targetSliderX,
      duration,
      (val) => setSliderX(val),
      () => setSliderX(null) // recalculate if null is the default
    );
  }

  // clock ticker and slider position
  useEffect(() => {
    let timeoutId: number;

    const tick = () => {
      setNow(new Date());
      timeoutId = setTimeout(tick, 1e3);
    };
    tick();
    refreshSlider();

    return () => clearTimeout(timeoutId);
  }, []);

  // event listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => handleMouseMove(e);
    const handleUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    window.addEventListener("resize", refreshSlider);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("resize", refreshSlider);
    };
  }, [dragging]);

  return (
    <div
      className="clocks"
      ref={containerRef}
      onMouseDown={handleContainerClick}
      onTouchStart={handleContainerClick}
    >
      <WorldClockSliderWrapper x={sliderX}>
        <WorldClockTooltip
          show={showTooltip}
          offsetMinutes={offsetMinutes}
          closeAction={resetSlider}
        />
        <WorldClockSliderLine
          value={offsetMinutes}
          min={-timeBound}
          max={timeBound}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
          onKeyDown={handleKeyDown}
        />
      </WorldClockSliderWrapper>
      {cities.map((city, i) => (
        <WorldClockRow key={i} localTime={localTime} city={city} />
      ))}
    </div>
  );
}

function WorldClockRow({ localTime, city }: WorldClockRowProps) {
  const cityTime = toZonedTime(localTime, city.timeZone);
  const { relative, full, short } = Utils.getRelativeTimestamp(
    localTime,
    cityTime
  );
  const hour = cityTime.getHours();
  const tod = Utils.getTimeOfDay(hour);
  const rowClass = `clocks__row clocks__row--${tod}`;

  return (
    <div className={rowClass}>
      <div className="clocks__start">
        <div className="clocks__city">{city.name}</div>
        <div className="clocks__relative clocks__relative--full">
          {relative}, {full}
        </div>
        <div className="clocks__relative clocks__relative--short">
          {relative}, {short}
        </div>
      </div>
      <div className="clocks__end">
        <div className="clocks__tod">
          <Icon name={tod} />
        </div>
        <div className="clocks__time">
          {format(cityTime, "h:mm")}
          <small className="clocks__m">{format(cityTime, "a")}</small>
        </div>
      </div>
    </div>
  );
}

function WorldClockSliderLine({
  value,
  min,
  max,
  onMouseDown,
  onTouchStart,
  onKeyDown,
}: WorldClockSliderLineProps) {
  return (
    <>
      <div id="slider-label" className="clocks__sr-only">
        Peek time
      </div>
      <div
        className="clocks__slider"
        tabIndex={0}
        role="slider"
        aria-labelledby="slider-label"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={Utils.formatOffset(value)}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onKeyDown={onKeyDown}
      >
        <div className="clocks__slider-line" />
        <div className="clocks__slider-arrow clocks__slider-arrow--left">
          <Icon name="triangle-left" />
        </div>
        <div className="clocks__slider-arrow clocks__slider-arrow--right">
          <Icon name="triangle-right" />
        </div>
      </div>
    </>
  );
}

function WorldClockSliderWrapper({
  x,
  children,
}: WorldClockSliderWrapperProps) {
  const sliderStyle = {
    left: x != null ? `${x}px` : "50%",
  };

  return (
    <div className="clocks__slider-wrapper" style={sliderStyle}>
      {children}
    </div>
  );
}

function WorldClockTooltip({
  show,
  offsetMinutes,
  closeAction,
}: WorldClockTooltipProps) {
  const toolTipClass = `clocks__tooltip${show ? " clocks__tooltip--show" : ""}`;

  return (
    <div className={toolTipClass}>
      {Utils.formatOffset(offsetMinutes)}
      <button
        className="clocks__tooltip-close"
        type="button"
        aria-label="Reset"
        onClick={closeAction}
        data-close
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

function Icon({ name }: IconProps) {
  const href = `#${name}`;

  return (
    <svg className="icon" width="16px" height="16px" aria-hidden="true">
      <use href={href} />
    </svg>
  );
}

function SVGSprites() {
  return (
    <svg width="0" height="0" display="none">
      <symbol id="close" viewBox="0 0 16 16">
        <g stroke="currentcolor" strokeLinecap="round" strokeWidth="2">
          <polyline points="2 2,14 14" />
          <polyline points="2 14,14 2" />
        </g>
      </symbol>
      <symbol id="day" viewBox="0 0 16 16">
        <path
          fill="currentcolor"
          d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"
        />
      </symbol>
      <symbol id="night" viewBox="0 0 16 16">
        <g fill="currentcolor">
          <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
          <path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L13.863.1z" />
        </g>
      </symbol>
      <symbol id="sunrise" viewBox="0 0 16 16">
        <path
          fill="currentcolor"
          d="M7.646 1.146a.5.5 0 0 1 .708 0l1.5 1.5a.5.5 0 0 1-.708.708L8.5 2.707V4.5a.5.5 0 0 1-1 0V2.707l-.646.647a.5.5 0 1 1-.708-.708l1.5-1.5zM2.343 4.343a.5.5 0 0 1 .707 0l1.414 1.414a.5.5 0 0 1-.707.707L2.343 5.05a.5.5 0 0 1 0-.707zm11.314 0a.5.5 0 0 1 0 .707l-1.414 1.414a.5.5 0 1 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zM11.709 11.5a4 4 0 1 0-7.418 0H.5a.5.5 0 0 0 0 1h15a.5.5 0 0 0 0-1h-3.79zM0 10a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2A.5.5 0 0 1 0 10zm13 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"
        />
      </symbol>
      <symbol id="sunset" viewBox="0 0 16 16">
        <path
          fill="currentcolor"
          d="M7.646 4.854a.5.5 0 0 0 .708 0l1.5-1.5a.5.5 0 0 0-.708-.708l-.646.647V1.5a.5.5 0 0 0-1 0v1.793l-.646-.647a.5.5 0 1 0-.708.708l1.5 1.5zm-5.303-.51a.5.5 0 0 1 .707 0l1.414 1.413a.5.5 0 0 1-.707.707L2.343 5.05a.5.5 0 0 1 0-.707zm11.314 0a.5.5 0 0 1 0 .706l-1.414 1.414a.5.5 0 1 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zM11.709 11.5a4 4 0 1 0-7.418 0H.5a.5.5 0 0 0 0 1h15a.5.5 0 0 0 0-1h-3.79zM0 10a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2A.5.5 0 0 1 0 10zm13 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"
        />
      </symbol>
      <symbol id="triangle-left" viewBox="0 0 16 16">
        <polygon fill="currentcolor" points="0 8,12 2,12 14" />
      </symbol>
      <symbol id="triangle-right" viewBox="0 0 16 16">
        <polygon fill="currentcolor" points="16 8,4 2,4 14" />
      </symbol>
    </svg>
  );
}

class Utils {
  static LOCALE = navigator.language;

  static animateValue(
    from: number,
    to: number,
    duration: number,
    onUpdate: (val: number) => void,
    onComplete: () => void
  ) {
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeInOutSine(progress);
      const currentValue = from + (to - from) * eased;

      onUpdate(currentValue);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        onComplete();
      }
    };
    requestAnimationFrame(frame);
  }

  static easeInOutSine(x: number): number {
    return -(Math.cos(Math.PI * x) - 1) / 2;
  }

  static formatOffset(mins: number): string {
    if (mins === 0) return "Now";

    const sign = mins >= 0 ? "+" : "-";
    const abs = Math.abs(mins);
    const hrs = Math.floor(abs / 60);
    const min = abs % 60;

    return `${sign}${hrs}:${String(min).padStart(2, "0")}`;
  }

  static formatShortDate(date: Date) {
    return new Intl.DateTimeFormat(this.LOCALE, {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  static getOffsetFromSliderX(
    x: number,
    containerWidth: number,
    maxOffset: number
  ): number {
    const centerX = containerWidth / 2;
    const deltaX = x - centerX;
    const ratio = deltaX / centerX;

    return Math.round(ratio * maxOffset);
  }

  static getRelativeTimestamp(timeA: Date, timeB: Date): RelativeTimestamp {
    const now = new Date();
    let relative = this.formatShortDate(timeB);
    if (isSameDay(now, timeB)) relative = "Today";
    if (isTomorrow(timeB)) relative = "Tomorrow";
    if (isYesterday(timeB)) relative = "Yesterday";

    const diffMs = timeB.getTime() - timeA.getTime();
    const diffTotalMinutes = Math.round(diffMs / (1000 * 60));
    const offsetAbsMinutes = Math.abs(diffTotalMinutes);
    const offsetHours = Math.floor(offsetAbsMinutes / 60);
    const is1Hour = offsetHours === 1;
    const hoursLabel = is1Hour ? "hour" : "hours";
    const offsetMinutes = offsetAbsMinutes % 60;
    const is1Minute = offsetMinutes === 1;
    const minutesLabel = is1Minute ? "minute" : "minutes";
    const ahead = diffTotalMinutes > 0;
    const behind = diffTotalMinutes < 0;
    const sign = ahead ? "+" : behind ? "-" : "±";
    const parts: string[] = [];

    if (offsetHours > 0) parts.push(`${offsetHours} ${hoursLabel}`);
    if (offsetMinutes > 0) parts.push(`${offsetMinutes} ${minutesLabel}`);
    if (parts.length === 0) parts.push("same time");

    let full = parts.join(" ");

    if (ahead) full += " ahead";
    if (behind) full += " behind";

    const shortHours = `${sign}${offsetHours}`;
    const shortMins = `${shortHours}:${offsetMinutes
      .toString()
      .padStart(2, "0")}`;
    const shortMins00 = `${shortHours}${is1Hour ? "HR" : "HRS"}`;
    const short = offsetMinutes > 0 ? shortMins : shortMins00;

    return { relative, full, short };
  }

  static getSliderXFromOffset(
    offsetMinutes: number,
    containerWidth: number,
    maxOffset: number
  ): number {
    const centerX = containerWidth / 2;

    return centerX + (offsetMinutes / maxOffset) * centerX;
  }

  static getTimeOfDay(hour: number): TimeOfDay {
    if (hour >= 6 && hour < 9) return "sunrise";
    if (hour >= 9 && hour < 18) return "day";
    if (hour >= 18 && hour < 20) return "sunset";
    return "night";
  }
}

// interfaces
interface IconProps {
  name?: string;
}

interface WorldClockRowProps {
  localTime: Date;
  city: City;
}

interface WorldClockSliderLineProps {
  value: number;
  min: number;
  max: number;
  onMouseDown: (e: JSX.TargetedMouseEvent<HTMLDivElement>) => void;
  onTouchStart: (e: JSX.TargetedTouchEvent<HTMLDivElement>) => void;
  onKeyDown: (e: JSX.TargetedKeyboardEvent<HTMLElement>) => void;
}

interface WorldClockSliderWrapperProps {
  x: number | null;
  children?: ComponentChildren;
}

interface WorldClockTooltipProps {
  show: boolean;
  offsetMinutes: number;
  closeAction: () => void;
}

// types
type City = {
  name: string;
  timeZone: string;
};
type RelativeTimestamp = {
  relative: string;
  full: string;
  short: string;
};
type TimeOfDay = "day" | "night" | "sunrise" | "sunset";

if (typeof window !== "undefined") {
  hydrate(<App />, document.getElementById("app"));
}

export async function prerender(data) {
  return await ssr(<App {...data} />);
}
