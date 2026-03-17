import type { IconProps } from "@phosphor-icons/react"
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly"
import { BugBeetleIcon } from "@phosphor-icons/react/dist/csr/BugBeetle"
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp"
import { CircuitryIcon } from "@phosphor-icons/react/dist/csr/Circuitry"
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code"
import { DatabaseIcon } from "@phosphor-icons/react/dist/csr/Database"
import { FileCodeIcon } from "@phosphor-icons/react/dist/csr/FileCode"
import { FilesIcon } from "@phosphor-icons/react/dist/csr/Files"
import { GitBranchIcon } from "@phosphor-icons/react/dist/csr/GitBranch"
import { GraphIcon } from "@phosphor-icons/react/dist/csr/Graph"
import { HardDrivesIcon } from "@phosphor-icons/react/dist/csr/HardDrives"
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House"
import { ListIcon } from "@phosphor-icons/react/dist/csr/List"
import { RowsIcon } from "@phosphor-icons/react/dist/csr/Rows"
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour"
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack"
import { TestTubeIcon } from "@phosphor-icons/react/dist/csr/TestTube"
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp"
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree"
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { XIcon } from "@phosphor-icons/react/dist/csr/X"

const systemIcons = {
  bracketsCurly: BracketsCurlyIcon,
  bugBeetle: BugBeetleIcon,
  chartLineUp: ChartLineUpIcon,
  circuitry: CircuitryIcon,
  code: CodeIcon,
  database: DatabaseIcon,
  fileCode: FileCodeIcon,
  files: FilesIcon,
  gitBranch: GitBranchIcon,
  graph: GraphIcon,
  hardDrives: HardDrivesIcon,
  house: HouseIcon,
  list: ListIcon,
  rows: RowsIcon,
  squaresFour: SquaresFourIcon,
  stack: StackIcon,
  testTube: TestTubeIcon,
  trendUp: TrendUpIcon,
  usersThree: UsersThreeIcon,
  warningCircle: WarningCircleIcon,
  x: XIcon,
} as const

export type SystemIconName = keyof typeof systemIcons

interface SystemIconProps extends Omit<IconProps, "children"> {
  name: SystemIconName
}

export function SystemIcon({ name, size = 18, ...props }: SystemIconProps) {
  const IconComponent = systemIcons[name]
  return <IconComponent size={size} {...props} />
}
