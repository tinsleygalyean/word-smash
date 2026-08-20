import { STAGE_W, STAGE_H, WALL_H, C, HAMMER_DOCK } from '../game/design';

const PLANK_XS = [180, 360, 560, 760, 960, 1120];

/** Static workshop backdrop: plank wall + shelf edge + workbench top. */
export function Background() {
  return (
    <>
      {/* WALL zone */}
      <div
        className="ws-wall"
        style={{
          height: WALL_H,
          background: `linear-gradient(180deg, ${C.wallTop} 0%, ${C.wallMid} 60%, ${C.wallBot} 100%)`,
        }}
      >
        {/* soft window light */}
        <div
          style={{
            position: 'absolute',
            left: STAGE_W * 0.24,
            top: -60,
            width: 420,
            height: 320,
            background: `radial-gradient(closest-side, ${C.windowLight}, transparent 72%)`,
            transform: 'rotate(-12deg)',
            pointerEvents: 'none',
          }}
        />
        {/* vertical planks */}
        {PLANK_XS.map((x) => (
          <div
            key={x}
            style={{
              position: 'absolute',
              left: x,
              top: 0,
              bottom: 0,
              width: 2,
              background: C.plank,
            }}
          />
        ))}
      </div>

      {/* BENCH zone */}
      <div
        className="ws-bench"
        style={{
          height: STAGE_H - WALL_H,
          background: `linear-gradient(180deg, ${C.benchTop} 0%, ${C.benchTop2} 22%, ${C.benchBot} 78%, ${C.benchBot2} 100%)`,
        }}
      >
        {/* front-edge highlight strip */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 26,
            background: `linear-gradient(180deg, ${C.edgeStripA} 0%, ${C.edgeStripB} 100%)`,
            boxShadow: '0 3px 6px rgba(90,55,20,.28)',
          }}
        />
        {/* board seams */}
        {[120, 300, 520, 760, 1000].map((y0, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 40 + i * 44,
              height: 2,
              background: C.boardLine,
            }}
          />
        ))}
      </div>

      {/* soft shadow line where wall meets bench */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: WALL_H - 3,
          height: 8,
          background: 'linear-gradient(180deg, rgba(90,55,20,.22), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* hammer dock recess (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          left: HAMMER_DOCK.x - 62,
          top: HAMMER_DOCK.y - 20,
          width: 124,
          height: 44,
          borderRadius: '50%',
          background: C.recess,
          filter: 'blur(1px)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
