export interface AwardInterval {
  producer: string;
  interval: number;
  previousWin: number;
  followingWin: number;
}

export interface AwardIntervals {
  min: AwardInterval[];
  max: AwardInterval[];
}
