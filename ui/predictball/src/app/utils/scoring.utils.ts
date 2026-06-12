import { Match, ScoringSystem } from '../models';

export interface PointsCalculationResult {
  totalPoints: number;
  pointsBreakdown: string;
}

/**
 * Calculates the total points and generates a breakdown for a given match prediction.
 */
export function calculatePredictionPoints(
  match: Match,
  scoringSystem: ScoringSystem | undefined | null,
  prediction: {
    homeScore: number | null;
    awayScore: number | null;
    scorerId: number | null;
    powerup: string | null;
    doubleScorerId: number | null;
  } | undefined | null
): PointsCalculationResult | null {
  if (!scoringSystem || !match || !prediction || !match.matchDetails ||
      (match.status !== 'FINISHED' && match.status !== 'IN_PLAY' && match.status !== 'PAUSED') ||
      prediction.homeScore === null || prediction.awayScore === null) {
    return null;
  }

  const actualHome = match.matchDetails.homeScore || 0;
  const actualAway = match.matchDetails.awayScore || 0;
  let predHome = prediction.homeScore;
  let predAway = prediction.awayScore;
  let reversalHelped = false;

  if (prediction.powerup === 'reversal' && actualHome !== actualAway) {
    const actualDiff = actualHome - actualAway;
    const predDiff = predHome - predAway;
    if ((actualDiff > 0 && predDiff < 0) || (actualDiff < 0 && predDiff > 0)) {
      predHome = prediction.awayScore!;
      predAway = prediction.homeScore!;
      reversalHelped = true;
    }
  }

  const scorerPts = Number((scoringSystem as any).scorer) || 0;
  const bothScorersPts = Number((scoringSystem as any).bothScorers) || 0;
  const exactScorePts = Number((scoringSystem as any).scoreExact || (scoringSystem as any).exactScore) || 0;
  const teamGoalsPts = Number((scoringSystem as any).scoreHomeExact || (scoringSystem as any).teamGoals) || 0;
  const resultPts = Number((scoringSystem as any).result) || 0;
  const goalDifPts = Number((scoringSystem as any).scoreDif || (scoringSystem as any).goalDif) || 0;

  let points = 0;
  let resultPoints = 0;
  let goalsPoints = 0;
  let goalDifPoints = 0;
  let homePoints = 0;
  let awayPoints = 0;
  let isExact = false;

  if (actualHome === predHome) {
    homePoints = teamGoalsPts;
    goalsPoints += homePoints;
  }
  if (actualAway === predAway) {
    awayPoints = teamGoalsPts;
    goalsPoints += awayPoints;
  }

  if (actualHome === predHome && actualAway === predAway) {
    isExact = true;
    goalsPoints += exactScorePts;
  }

  points += goalsPoints;

  if (Math.sign(actualHome - actualAway) === Math.sign(predHome - predAway)) {
    resultPoints = resultPts;
    points += resultPoints;
  }
  if (actualHome - actualAway === predHome - predAway) {
    goalDifPoints = goalDifPts;
    points += goalDifPoints;
  }

  const actualScorers = match.matchDetails.scorers?.map((s: any) => (s && s.id ? Number(s.id) : 0)).filter((id: number) => id > 0) || [];
  const scorerCounts: Record<number, number> = {};
  actualScorers.forEach((id: number) => {
    scorerCounts[id] = (scorerCounts[id] || 0) + 1;
  });

  const predictedScorerId = prediction.scorerId ? Number(prediction.scorerId) : 0;
  const predictedDoubleScorerId = prediction.doubleScorerId ? Number(prediction.doubleScorerId) : 0;

  let scorerPoints = 0;
  let firstScorerCorrect = false;
  let secondScorerCorrect = false;

  if (actualScorers.length === 0 && predictedScorerId === 0) {
    scorerPoints += scorerPts;
    firstScorerCorrect = true;
  } else if (predictedScorerId !== 0 && scorerCounts[predictedScorerId] > 0) {
    scorerPoints += scorerPts;
    scorerCounts[predictedScorerId]--;
    firstScorerCorrect = true;
  }

  if (prediction.powerup === 'doubleScorer' && predictedDoubleScorerId !== 0 && scorerCounts[predictedDoubleScorerId] > 0) {
    scorerPoints += scorerPts;
    scorerCounts[predictedDoubleScorerId]--;
    secondScorerCorrect = true;
  }

  if (firstScorerCorrect && secondScorerCorrect) {
    scorerPoints += bothScorersPts;
  }

  let totalPoints = points + scorerPoints;

  if (prediction.powerup === 'tripleScore') {
    totalPoints *= 3;
  }

  const breakdown: string[] = [];

  breakdown.push(`Result: ${resultPoints} pts`);
  breakdown.push(`Team goals: ${homePoints + awayPoints} pts`);
  breakdown.push(`Exact score bonus: ${isExact ? exactScorePts : 0} pts`);
  breakdown.push(`Goal difference: ${goalDifPoints} pts`);
  breakdown.push(`Scorers: ${scorerPoints} pts`);

  if (prediction.powerup === 'tripleScore') {
    breakdown.push('x3');
  }

  if (reversalHelped) {
    breakdown.push('SCORE REVERSAL USED!');
  }

  return {
    totalPoints,
    pointsBreakdown: breakdown.join('\n')
  };
}