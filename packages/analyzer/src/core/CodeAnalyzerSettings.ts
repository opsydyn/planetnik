export interface CodeAnalyzerSettingsType {
	readonly dataOnly: boolean;
	readonly updateIndex: boolean;
	readonly analyzeFilesInScope: boolean;
	readonly analyzeLogicalDecomposition: boolean;
	readonly analyzeStaticDependencies: boolean;
	readonly analyzeConcerns: boolean;
	readonly analyzeDuplication: boolean;
	readonly analyzeFileSize: boolean;
	readonly analyzeFileHistory: boolean;
	readonly analyzeContributors: boolean;
	readonly analyzeUnitSize: boolean;
	readonly analyzeConditionalComplexity: boolean;
	readonly createMetricsList: boolean;
	readonly analyzeControls: boolean;
	readonly analyzeFindings: boolean;
}

const allTrue: CodeAnalyzerSettingsType = {
	dataOnly: false,
	updateIndex: true,
	analyzeFilesInScope: true,
	analyzeLogicalDecomposition: true,
	analyzeStaticDependencies: true,
	analyzeConcerns: true,
	analyzeDuplication: true,
	analyzeFileSize: true,
	analyzeFileHistory: true,
	analyzeContributors: true,
	analyzeUnitSize: true,
	analyzeConditionalComplexity: true,
	createMetricsList: true,
	analyzeControls: true,
	analyzeFindings: true,
};

const allFalse: CodeAnalyzerSettingsType = {
	dataOnly: false,
	updateIndex: false,
	analyzeFilesInScope: false,
	analyzeLogicalDecomposition: false,
	analyzeStaticDependencies: false,
	analyzeConcerns: false,
	analyzeDuplication: false,
	analyzeFileSize: false,
	analyzeFileHistory: false,
	analyzeContributors: false,
	analyzeUnitSize: false,
	analyzeConditionalComplexity: false,
	createMetricsList: false,
	analyzeControls: false,
	analyzeFindings: false,
};

export const CodeAnalyzerSettings = {
	make(
		overrides: Partial<CodeAnalyzerSettingsType> = {},
	): CodeAnalyzerSettingsType {
		return { ...allTrue, ...overrides };
	},

	selectAll(): CodeAnalyzerSettingsType {
		return { ...allTrue };
	},

	deselectAll(): CodeAnalyzerSettingsType {
		return { ...allFalse };
	},
};
