import { sounds } from './audio.js';

export class GameManager {
  constructor(scoreboard, onStateChanged) {
    this.scoreboard = scoreboard;
    this.onStateChanged = onStateChanged;

    this.modes = ['301', '501', 'around-clock', 'free-play'];
    this.modeIndex = 0;
    this.currentMode = '301';

    // Game stats
    this.score = 301;
    this.startScore = 301;
    this.roundNumber = 1;
    this.roundDarts = []; // Max 3 darts per round
    this.roundStartScore = 301;
    this.announcement = 'GAME ON!';
    this.announcementTimer = null;

    // Around the clock target
    this.clockTarget = 1;

    // Lifetime statistics
    this.stats = {
      totalThrows: 0,
      totalScore: 0,
      highestTurn: 0,
      count180: 0,
      bullseyes: 0,
      average: '0.0'
    };

    this.isTurnFinished = false;
    this.isGameOver = false;

    this.updateScoreboard();
  }

  setAnnouncement(text, duration = 3000) {
    this.announcement = text;
    this.updateScoreboard();

    if (this.announcementTimer) clearTimeout(this.announcementTimer);
    if (duration > 0) {
      this.announcementTimer = setTimeout(() => {
        this.announcement = '';
        this.updateScoreboard();
      }, duration);
    }
  }

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % this.modes.length;
    this.setMode(this.modes[this.modeIndex]);
  }

  setMode(modeName) {
    this.currentMode = modeName;
    this.resetGame();
  }

  resetGame() {
    this.roundNumber = 1;
    this.roundDarts = [];
    this.isGameOver = false;
    this.isTurnFinished = false;

    if (this.currentMode === '301') {
      this.startScore = 301;
      this.score = 301;
    } else if (this.currentMode === '501') {
      this.startScore = 501;
      this.score = 501;
    } else if (this.currentMode === 'around-clock') {
      this.clockTarget = 1;
      this.score = 1;
    } else {
      // Free play
      this.score = 0;
    }

    this.roundStartScore = this.score;
    this.setAnnouncement(`NEW GAME: ${this.currentMode.toUpperCase()}`);
    this.updateScoreboard();
  }

  registerHit(scoreData) {
    if (this.isGameOver || this.roundDarts.length >= 3) return;

    this.stats.totalThrows++;
    this.stats.totalScore += scoreData.score;
    this.roundDarts.push(scoreData);

    if (scoreData.isBull) this.stats.bullseyes++;

    // Mode-specific scoring
    if (this.currentMode === '301' || this.currentMode === '501') {
      const remaining = this.score - scoreData.score;

      if (remaining === 0) {
        // WIN!
        this.score = 0;
        this.isGameOver = true;
        this.setAnnouncement('★ GAME SHOT AND THE MATCH! ★', 6000);
        sounds.playFanfare();
      } else if (remaining < 0 || remaining === 1) {
        // BUST! (In darts countdown, you cannot leave 1 or go below 0)
        this.score = this.roundStartScore; // revert round
        this.setAnnouncement('BUST!', 3500);
        sounds.playWood();
        this.isTurnFinished = true;
      } else {
        this.score = remaining;
        if (scoreData.score === 60) {
          this.setAnnouncement('TREBLE 20!');
        } else if (scoreData.isBull) {
          this.setAnnouncement('BULLSEYE! (50)');
        }
      }
    } else if (this.currentMode === 'around-clock') {
      // Must hit current target sector
      if (scoreData.sector === this.clockTarget || (this.clockTarget === 21 && scoreData.isBull)) {
        // Hit target!
        const advance = scoreData.multiplier; // Doubles and triples advance extra
        this.clockTarget += advance;
        if (this.clockTarget > 20) {
          this.clockTarget = 21; // 21 represents Bullseye
        }

        if (this.clockTarget > 21 || (this.clockTarget === 21 && scoreData.isBull)) {
          this.isGameOver = true;
          this.setAnnouncement('★ AROUND THE CLOCK COMPLETED! ★', 6000);
          sounds.playFanfare();
        } else {
          this.setAnnouncement(`HIT! NEXT: ${this.clockTarget === 21 ? 'BULL' : this.clockTarget}`);
          sounds.playFanfare();
        }
      } else {
        this.setAnnouncement(`TARGET: ${this.clockTarget === 21 ? 'BULL' : this.clockTarget}`);
      }
      this.score = this.clockTarget === 21 ? 'BULL' : this.clockTarget;
    } else {
      // Free Play
      this.score += scoreData.score;
      if (scoreData.score >= 50) {
        this.setAnnouncement(scoreData.label);
      }
    }

    // Check if 3 darts thrown this turn
    if (this.roundDarts.length >= 3) {
      this.isTurnFinished = true;
      const turnTotal = this.roundDarts.reduce((acc, d) => acc + d.score, 0);

      if (turnTotal > this.stats.highestTurn) {
        this.stats.highestTurn = turnTotal;
      }

      if (turnTotal === 180) {
        this.stats.count180++;
        this.setAnnouncement('★★★ 180! ONE HUNDRED & EIGHTY! ★★★', 5000);
        sounds.play180();
      } else if (turnTotal >= 100) {
        this.setAnnouncement(`GREAT TURN: ${turnTotal}!`, 3000);
        sounds.playFanfare();
      }
    }

    // Update 3-dart average
    const roundsCount = Math.max(1, this.roundNumber);
    const avg = ((this.stats.totalScore / this.stats.totalThrows) * 3).toFixed(1);
    this.stats.average = avg;

    this.updateScoreboard();
  }

  nextTurn() {
    if (this.roundDarts.length === 0) return;

    this.roundNumber++;
    this.roundDarts = [];
    this.roundStartScore = this.score;
    this.isTurnFinished = false;

    this.updateScoreboard();
  }

  getCurrentRoundScore() {
    return this.roundDarts.reduce((acc, d) => acc + d.score, 0);
  }

  updateScoreboard() {
    const state = {
      mode: this.currentMode,
      score: this.score,
      darts: this.roundDarts,
      currentRoundScore: this.getCurrentRoundScore(),
      roundNumber: this.roundNumber,
      stats: this.stats,
      announcement: this.announcement,
      isTurnFinished: this.isTurnFinished,
      isGameOver: this.isGameOver
    };

    if (this.scoreboard) {
      this.scoreboard.render(state);
    }

    if (this.onStateChanged) {
      this.onStateChanged(state);
    }
  }
}
