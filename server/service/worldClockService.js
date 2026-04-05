"use strict";

const {
  GaWorldClock,
  GaWorldMonthDef,
} = require("../models");

const MS_REAL_POR_HORA = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;
const DEFAULT_DAYS_PER_MONTH = 30;

let anchorCache = null;
let monthsCache = null;

function normalizeAnchor(row) {
  if (!row) {
    throw new Error("[WORLD CLOCK] Anchor not found in ga_world_clock.");
  }

  return {
    id: Number(row.id),
    anchorRealMs: Number(row.anchor_real_ms),
    anchorWorldHours: Number(row.anchor_world_hours),
    timeFactor: Number(row.time_factor),
  };
}

function normalizeMonth(row) {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    mood: row.mood ? String(row.mood) : null,
    season: String(row.season),
    orderIndex: Number(row.order_index),
    daysInMonth: Number(row.days_in_month ?? DEFAULT_DAYS_PER_MONTH),
    isActive: Boolean(row.is_active),
  };
}

async function loadAnchorFromDb() {
  const row = await GaWorldClock.findOne({
    order: [["id", "ASC"]],
    raw: true,
  });

  anchorCache = normalizeAnchor(row);
  return anchorCache;
}

async function loadMonthsFromDb() {
  const rows = await GaWorldMonthDef.findAll({
    where: { is_active: true },
    order: [["order_index", "ASC"]],
    raw: true,
  });

  monthsCache = rows.map(normalizeMonth);
  return monthsCache;
}

async function initWorldClock() {
  await Promise.all([loadAnchorFromDb(), loadMonthsFromDb()]);
}

async function getAnchor() {
  return anchorCache ?? loadAnchorFromDb();
}

async function getMonths() {
  return monthsCache ?? loadMonthsFromDb();
}

async function getTimeFactor() {
  const anchor = await getAnchor();
  return Number(anchor?.timeFactor ?? 1);
}

function decomposeWorldTime(totalWorldHours, daysPerMonth = DEFAULT_DAYS_PER_MONTH, monthsPerYear = 12) {
  const wholeHours = Math.floor(totalWorldHours);
  const totalDays = Math.floor(wholeHours / HOURS_PER_DAY);
  const hour = ((wholeHours % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;

  const daysPerYear = daysPerMonth * monthsPerYear;
  const year = Math.floor(totalDays / daysPerYear);
  const dayOfYear = totalDays % daysPerYear;
  const monthIndex = Math.floor(dayOfYear / daysPerMonth);
  const dayIndex = dayOfYear % daysPerMonth;

  const minute = Math.floor((totalWorldHours % 1) * 60);

  return {
    year,
    month: monthIndex + 1,
    day: dayIndex + 1,
    hour,
    minute,
  };
}

async function getCurrentWorldTime() {
  const anchor = await getAnchor();
  const months = await getMonths();
  const monthsPerYear = months.length || 12;
  const daysPerMonth = months[0]?.daysInMonth || DEFAULT_DAYS_PER_MONTH;

  const nowRealMs = Date.now();
  const deltaRealMs = nowRealMs - anchor.anchorRealMs;
  const totalWorldHours =
    anchor.anchorWorldHours +
    (deltaRealMs / MS_REAL_POR_HORA) * anchor.timeFactor;

  const decomposed = decomposeWorldTime(totalWorldHours, daysPerMonth, monthsPerYear);
  const monthMeta = months.find((month) => month.orderIndex === decomposed.month) ?? null;

  return {
    ...decomposed,
    totalWorldHours,
    isNight: decomposed.hour < 6 || decomposed.hour >= 18,
    monthMeta,
  };
}

async function getWorldClockBootstrap() {
  const [anchor, months, currentTime] = await Promise.all([
    getAnchor(),
    getMonths(),
    getCurrentWorldTime(),
  ]);

  return {
    anchor,
    calendar: {
      hoursPerDay: HOURS_PER_DAY,
      daysPerMonth: months[0]?.daysInMonth || DEFAULT_DAYS_PER_MONTH,
      monthsPerYear: months.length || 12,
    },
    months,
    currentTime,
  };
}

module.exports = {
  DEFAULT_DAYS_PER_MONTH,
  HOURS_PER_DAY,
  MS_REAL_POR_HORA,
  decomposeWorldTime,
  getAnchor,
  getCurrentWorldTime,
  getMonths,
  getTimeFactor,
  getWorldClockBootstrap,
  initWorldClock,
};
