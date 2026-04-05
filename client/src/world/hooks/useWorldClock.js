import { useEffect, useMemo, useRef, useState } from "react";

const MS_REAL_POR_HOUR = 60 * 60 * 1000;
const DEFAULT_HOURS_PER_DAY = 24;
const DEFAULT_DAYS_PER_MONTH = 30;
const DEFAULT_MONTHS_PER_YEAR = 12;

function decomposeWorldTime(
  totalWorldHours,
  daysPerMonth = DEFAULT_DAYS_PER_MONTH,
  monthsPerYear = DEFAULT_MONTHS_PER_YEAR
) {
  const wholeHours = Math.floor(totalWorldHours);
  const totalDays = Math.floor(wholeHours / DEFAULT_HOURS_PER_DAY);
  const hour =
    ((wholeHours % DEFAULT_HOURS_PER_DAY) + DEFAULT_HOURS_PER_DAY) %
    DEFAULT_HOURS_PER_DAY;
  const minute = Math.floor((totalWorldHours % 1) * 60);

  const daysPerYear = daysPerMonth * monthsPerYear;
  const year = Math.floor(totalDays / daysPerYear);
  const dayOfYear = totalDays % daysPerYear;
  const month = Math.floor(dayOfYear / daysPerMonth) + 1;
  const day = (dayOfYear % daysPerMonth) + 1;

  return {
    year,
    month,
    day,
    hour,
    minute,
  };
}

export function useWorldClock(worldClock) {
  const anchorRef = useRef(worldClock?.anchor ?? null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    anchorRef.current = worldClock?.anchor ?? null;
  }, [worldClock]);

  useEffect(() => {
    if (!worldClock?.anchor) return undefined;

    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [worldClock?.anchor]);

  return useMemo(() => {
    const anchor = anchorRef.current;
    const months = Array.isArray(worldClock?.months) ? worldClock.months : [];
    const calendar = worldClock?.calendar ?? {};
    const monthsPerYear = months.length || calendar.monthsPerYear || DEFAULT_MONTHS_PER_YEAR;
    const daysPerMonth = months[0]?.daysInMonth || calendar.daysPerMonth || DEFAULT_DAYS_PER_MONTH;

    if (!anchor) return null;

    const deltaRealMs = Date.now() - Number(anchor.anchorRealMs);
    const totalWorldHours =
      Number(anchor.anchorWorldHours) +
      (deltaRealMs / MS_REAL_POR_HOUR) * Number(anchor.timeFactor);

    const base = decomposeWorldTime(totalWorldHours, daysPerMonth, monthsPerYear);
    const monthMeta =
      months.find((month) => Number(month.orderIndex) === Number(base.month)) ?? null;

    return {
      ...base,
      totalWorldHours,
      isNight: base.hour < 6 || base.hour >= 18,
      monthMeta,
      tick,
    };
  }, [tick, worldClock]);
}
