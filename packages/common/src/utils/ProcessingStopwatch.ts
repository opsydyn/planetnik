export class ProcessingTimes {
	readonly processing: string;
	startMs: number;
	endMs: number = 0;

	constructor(processing: string) {
		this.processing = processing;
		this.startMs = Date.now();
	}

	start(): void {
		this.startMs = Date.now();
	}

	end(): void {
		this.endMs = Date.now();
	}

	getDurationMs(): number {
		const end = this.endMs > 0 ? this.endMs : Date.now();
		return end - this.startMs;
	}
}

export class ProcessingStopwatch {
	private static monitors: ProcessingTimes[] = [];
	private static monitorsMap = new Map<string, ProcessingTimes>();
	private static referenceTimes: ProcessingTimes | null = null;

	static startAsReference(name: string): ProcessingTimes {
		const pt = ProcessingStopwatch.start(name);
		ProcessingStopwatch.referenceTimes = pt;
		return pt;
	}

	static start(name: string): ProcessingTimes {
		const pt = new ProcessingTimes(name);
		ProcessingStopwatch.monitors.push(pt);
		ProcessingStopwatch.monitorsMap.set(name, pt);
		return pt;
	}

	static end(name: string): void {
		const pt = ProcessingStopwatch.monitorsMap.get(name);
		if (pt) pt.end();
	}

	static getMonitors(): readonly ProcessingTimes[] {
		return ProcessingStopwatch.monitors;
	}

	static reset(): void {
		ProcessingStopwatch.monitors = [];
		ProcessingStopwatch.monitorsMap.clear();
		ProcessingStopwatch.referenceTimes = null;
	}

	static print(): void {
		for (const pt of ProcessingStopwatch.monitors) {
			const duration = pt.getDurationMs();
			const pct = ProcessingStopwatch.getPercentage(duration);
			console.log(`${pt.processing}: ${(duration / 1000).toFixed(2)}s ${pct}`);
		}
	}

	private static getPercentage(durationMs: number): string {
		if (!ProcessingStopwatch.referenceTimes) return "";
		const refDuration = ProcessingStopwatch.referenceTimes.getDurationMs();
		if (refDuration === 0) return "";
		const pct = (100 * durationMs) / refDuration;
		return `(${pct.toFixed(1)}%)`;
	}
}
