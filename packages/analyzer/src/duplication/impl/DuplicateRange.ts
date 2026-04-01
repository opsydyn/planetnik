export class DuplicateRange {
	constructor(
		public start: number,
		public end: number,
	) {}

	includes(other: DuplicateRange): boolean {
		return this.start <= other.start && this.end >= other.end;
	}
}

export class DuplicateRangePair {
	constructor(
		public range1: DuplicateRange,
		public range2: DuplicateRange,
	) {}

	includes(otherRange1: DuplicateRange, otherRange2: DuplicateRange): boolean {
		return (
			this.range1.includes(otherRange1) && this.range2.includes(otherRange2)
		);
	}
}

export class DuplicateRangePairs {
	ranges: DuplicateRangePair[] = [];

	includes(pair: DuplicateRangePair): boolean {
		for (const existing of this.ranges) {
			if (existing.includes(pair.range1, pair.range2)) {
				return true;
			}
		}
		return false;
	}
}
