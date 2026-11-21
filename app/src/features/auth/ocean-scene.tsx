import styles from './ocean-scene.module.css';

// All decorative motion lives in CSS. No timers, canvas or animation effects run
// alongside authentication. SVG stays sharp on phones and high-density displays.
const wavePath =
  'M0 38 C120 16 240 60 360 38 C480 16 600 60 720 38 ' +
  'C840 16 960 60 1080 38 C1200 16 1320 60 1440 38 V120 H0Z';

function Wave({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 120" preserveAspectRatio="none" focusable="false">
      <path d={wavePath} />
    </svg>
  );
}

function TrawlBoat() {
  return (
    <svg viewBox="0 0 360 220" className={styles.trawler} focusable="false">
      <ellipse
        className={styles.boatShadow}
        cx="178"
        cy="189"
        rx="133"
        ry="8"
        fill="#153d44"
        opacity=".18"
      />
      <g stroke="#314949" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* Stern A-frame and the small net hanging from its boom. */}
        <path d="M78 148 119 63 157 148 M91 121H145 M119 63V148" fill="none" />
        <path d="M119 65 48 109 M119 65 63 113 M119 65 168 110" fill="none" strokeWidth="1.4" />
        <path
          d="M47 109 67 113 70 145 55 153 44 142Z"
          fill="#b6aa86"
          stroke="#7d795e"
          strokeWidth="1.3"
        />
        <path
          d="M48 118 68 130 M46 129 68 141 M55 114 54 146 M63 115 62 148"
          fill="none"
          stroke="#8d8668"
          strokeWidth=".9"
        />
        {/* Mast, antenna, rope and a quiet pennant. */}
        <path
          d="M177 149V35 M165 60H191 M177 43 293 131 M177 50 129 144"
          fill="none"
          strokeWidth="1.5"
        />
        <path d="M177 38 198 43 177 49Z" fill="#c7805e" stroke="none" />
        <path d="M176 34 181 21 M174 32 168 24" fill="none" strokeWidth="1.2" />
        {/* Wheelhouse faces the bow on the right. */}
        <path d="M206 145V99H266L281 145Z" fill="#f4efe2" />
        <path d="M201 98H271L276 104H202Z" fill="#344e4d" stroke="none" />
        <path
          d="M215 109H235V126H215Z M242 109H261L268 126H242Z"
          fill="#789d9f"
          strokeWidth="1.3"
        />
        <path d="M220 109 215 119 M250 109 243 120" stroke="#c5d9d5" strokeWidth="1" />
        <path d="M210 134H224V146H210Z" fill="#d8d3c8" strokeWidth="1.2" />
        <path d="M247 97V85H255V97" fill="#445a55" strokeWidth="1.5" />
        {/* Low deck rails, float and hull. */}
        <path
          d="M75 146V127H201 M86 127V146 M115 127V146 M145 127V146 M174 127V146 M282 143V126H312V141 M296 126V143"
          fill="none"
          strokeWidth="1.8"
        />
        <path d="M36 147H297L340 131 320 171Q288 191 157 190L71 179Z" fill="#83a79d" />
        <path d="M48 159H313L320 151H43Z" fill="#d8d3c8" stroke="none" />
        <path d="M61 173 73 180 157 191Q287 192 319 172" fill="#335b5c" stroke="none" />
        <path d="M37 147H297L340 131" fill="none" stroke="#2b4545" strokeWidth="3.4" />
        <circle cx="286" cy="135" r="10" fill="#e3a17b" stroke="#b87655" strokeWidth="1.5" />
        <circle cx="286" cy="135" r="4.6" fill="#f7eddb" stroke="none" />
        <circle cx="244" cy="168" r="3" fill="#355953" stroke="none" />
        <circle cx="266" cy="167" r="3" fill="#355953" stroke="none" />
        <path
          d="M88 193Q113 188 139 193 M200 200Q237 194 276 198"
          fill="none"
          stroke="#cee0d7"
          strokeWidth="2.3"
          opacity=".65"
        />
      </g>
    </svg>
  );
}

function JumpingFish({ className }: { className: string }) {
  return (
    <div className={className}>
      <span className={styles.splashStart} />
      <svg className={styles.fish} viewBox="0 0 50 26" focusable="false">
        {/* A right-facing fish; motion always travels forward from left to right. */}
        <path d="M12 13 2 4V22L12 13C22 0 37 2 47 13 37 24 22 26 12 13Z" fill="#d5e6dd" />
        <path d="M20 7 27 1 31 7 M21 19 28 25 32 19" fill="#a9c5bb" />
        <path d="M16 13H34" stroke="#aac7bd" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="38" cy="10" r="1.5" fill="#345c60" />
      </svg>
      <span className={styles.splashEnd} />
    </div>
  );
}

export function OceanScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.sky}>
        <div className={styles.haze} />
        <div className={styles.sunDisc} />
      </div>
      <div className={styles.water} />
      <div className={styles.horizonLine} />
      <div className={styles.reflection} />
      <Wave className={styles.farWave} />
      <div className={styles.boatDrift}>
        <TrawlBoat />
      </div>
      <Wave className={styles.middleWave} />
      <JumpingFish className={`${styles.fishGroup} ${styles.fishOne}`} />
      <JumpingFish className={`${styles.fishGroup} ${styles.fishTwo}`} />
      <JumpingFish className={`${styles.fishGroup} ${styles.fishThree}`} />
      <Wave className={styles.frontWave} />
      <div className={styles.waterGrain} />
    </div>
  );
}
