import { FC, useEffect, useState } from 'react';
import styles from './WaitingScene.module.css';

interface WaitingSceneProps {
  readonly message?: string;
}

export const WaitingScene: FC<WaitingSceneProps> = ({
  message = 'Waiting for opponent...',
}) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      // 640x360 is the internal resolution of the pixel art canvas
      const scaleX = window.innerWidth / 640;
      const scaleY = window.innerHeight / 360;
      
      // We use Math.max to ensure the canvas covers the entire screen.
      // This works identically to background-size: cover, without CSS rendering distortions.
      setScale(Math.max(scaleX, scaleY));
    };

    handleResize(); // Initial scale
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={styles.scene}>
      {/* 
        We use a fixed-size pixel canvas and scale it dynamically 
        via React to ensure perfectly crisp 8-bit rendering. This avoids 
        fractional sub-pixel rendering bugs in CSS that distort the art.
      */}
      <div 
        className={styles.pixelCanvas}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {/* Wall & Counter */}
        <div className={styles.wall} />
        <div className={styles.counterTop} />
        <div className={styles.counterFront} />

        {/* Window Background (Sky, Moon, Stars, Rain) */}
        <div className={styles.window}>
          <div className={styles.moon} />
          
          <div className={`${styles.star} ${styles.star1}`} />
          <div className={`${styles.star} ${styles.star2}`} />
          <div className={`${styles.star} ${styles.star3}`} />
          <div className={`${styles.star} ${styles.star4}`} />
          <div className={`${styles.star} ${styles.star5}`} />
          <div className={`${styles.star} ${styles.star6}`} />

          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={`rain-${i}`}
              className={styles.rainDrop}
              style={{
                left: `${(i * 37) % 480}px`,
                animationDelay: `${(i * 0.17) % 0.4}s`,
              }}
            />
          ))}

          {/* Window Panes Overlay */}
          <div className={styles.windowDividerH} />
          <div className={styles.windowDividerV1} />
          <div className={styles.windowDividerV2} />
        </div>

        {/* Shelves on Wall */}
        <div className={styles.shelf}>
          <div className={`${styles.potion} ${styles.pRed}`} />
          <div className={`${styles.potion} ${styles.pBlue}`} />
          <div className={`${styles.potion} ${styles.pGreen}`} />
        </div>

        {/* Neon Sign */}
        <div className={styles.neonSign}>
          <div className={styles.neonText}>TAVERN</div>
        </div>

        {/* Lantern */}
        <div className={styles.lantern}>
          <div className={styles.lanternChain} />
          <div className={styles.lanternBody} />
          <div className={styles.lanternGlow} />
        </div>

        {/* Wizard behind the desk */}
        <div className={styles.wizard}>
          <div className={styles.wizardRobe}>
            <div className={styles.wizardRobeDetail} />
          </div>
          <div className={styles.wizardHead}>
            <div className={styles.wizardEyeL} />
            <div className={styles.wizardEyeR} />
            <div className={styles.wizardBeard} />
          </div>
          <div className={styles.wizardHat}>
            <div className={styles.hatL1}>
              <div className={styles.hatBand} />
            </div>
            <div className={styles.hatL2} />
            <div className={styles.hatL3} />
            <div className={styles.hatL4} />
          </div>
          {/* Arms resting on the desk */}
          <div className={styles.wizardArmL}>
            <div className={styles.wizardHandL} />
          </div>
          <div className={styles.wizardArmR}>
            <div className={styles.wizardHandR} />
          </div>
        </div>

        {/* Items ON the desk */}
        <div className={styles.mug}>
          <div className={styles.mugBody} />
          <div className={styles.mugHandle} />
          <div className={`${styles.steam} ${styles.steam1}`} />
          <div className={`${styles.steam} ${styles.steam2}`} />
        </div>

        <div className={styles.orb}>
          <div className={styles.orbCore} />
        </div>

        <div className={styles.cards}>
          <div className={`${styles.card} ${styles.card1}`} />
          <div className={`${styles.card} ${styles.card2}`} />
          <div className={`${styles.card} ${styles.card3}`} />
        </div>

        {/* Sleeping Cat */}
        <div className={styles.cat}>
          <div className={styles.catZzz}>Z</div>
          <div className={styles.catZzz2}>Z</div>
          <div className={styles.catBodyTop} />
          <div className={styles.catBody} />
          <div className={styles.catHead}>
            <div className={styles.catEarL} />
            <div className={styles.catEarR} />
          </div>
        </div>

        {/* Floating Mana Particles */}
        <div className={`${styles.manaParticle} ${styles.m1}`} />
        <div className={`${styles.manaParticle} ${styles.m2}`} />
        <div className={`${styles.manaParticle} ${styles.m3}`} />
        <div className={`${styles.manaParticle} ${styles.m4}`} />
        <div className={`${styles.manaParticle} ${styles.m5}`} />

        {/* CRT Scanline Filter over the whole scene */}
        <div className={styles.crtOverlay} />

      </div>

      {/* Restored Message */}
      <div className={styles.message}>
        <span className={styles.msgText}>{message}</span>
        <span className={styles.dots}>
          <span style={{ animationDelay: '0s' }}>.</span>
          <span style={{ animationDelay: '0.3s' }}>.</span>
          <span style={{ animationDelay: '0.6s' }}>.</span>
        </span>
      </div>
    </div>
  );
};
