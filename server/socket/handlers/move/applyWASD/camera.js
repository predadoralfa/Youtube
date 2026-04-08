"use strict";

const MIN_CAMERA_PITCH = Math.PI / 12;
const MAX_CAMERA_PITCH = (Math.PI * 4) / 9;
const MIN_CAMERA_DISTANCE = 6;
const MAX_CAMERA_DISTANCE = 55;

function normalizeAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function clampCameraPitch(value) {
  return Math.min(MAX_CAMERA_PITCH, Math.max(MIN_CAMERA_PITCH, value));
}

function clampCameraDistance(value) {
  return Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, value));
}

module.exports = {
  normalizeAngle,
  clampCameraPitch,
  clampCameraDistance,
};
