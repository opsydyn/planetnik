import type { Metric } from "../metrics/Metric.js";
import type { MetricRangeControlType } from "../metrics/MetricRangeControl.js";

export class ControlStatus {
	control: MetricRangeControlType | null = null;
	metric: Metric | null = null;
	status: string = "";
}
