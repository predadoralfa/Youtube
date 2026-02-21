// server/state/persistence/rev.js

function bumpRev(rt) {
  const cur = Number(rt.rev ?? 0);
  rt.rev = Number.isFinite(cur) ? cur + 1 : 1;
}

module.exports = {
  bumpRev,
};