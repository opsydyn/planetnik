import type { IconProps } from "@phosphor-icons/react"
import { BracketsCurlyIcon } from "@phosphor-icons/react/dist/csr/BracketsCurly"
import { BugBeetleIcon } from "@phosphor-icons/react/dist/csr/BugBeetle"
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp"
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle"
import { CircuitryIcon } from "@phosphor-icons/react/dist/csr/Circuitry"
import { CodeIcon } from "@phosphor-icons/react/dist/csr/Code"
import { DatabaseIcon } from "@phosphor-icons/react/dist/csr/Database"
import { DesktopIcon } from "@phosphor-icons/react/dist/csr/Desktop"
import { FileCodeIcon } from "@phosphor-icons/react/dist/csr/FileCode"
import { FilesIcon } from "@phosphor-icons/react/dist/csr/Files"
import { GitBranchIcon } from "@phosphor-icons/react/dist/csr/GitBranch"
import { GraphIcon } from "@phosphor-icons/react/dist/csr/Graph"
import { HardDrivesIcon } from "@phosphor-icons/react/dist/csr/HardDrives"
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House"
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning"
import { ListIcon } from "@phosphor-icons/react/dist/csr/List"
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon"
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause"
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play"
import { RowsIcon } from "@phosphor-icons/react/dist/csr/Rows"
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/csr/SidebarSimple"
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour"
import { StackIcon } from "@phosphor-icons/react/dist/csr/Stack"
import { SunIcon } from "@phosphor-icons/react/dist/csr/Sun"
import { TestTubeIcon } from "@phosphor-icons/react/dist/csr/TestTube"
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp"
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree"
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle"
import { XIcon } from "@phosphor-icons/react/dist/csr/X"

const systemIcons = {
  bracketsCurly: BracketsCurlyIcon,
  "brackets-curly": BracketsCurlyIcon,
  bugBeetle: BugBeetleIcon,
  "bug-beetle": BugBeetleIcon,
  chartLineUp: ChartLineUpIcon,
  "chart-line-up": ChartLineUpIcon,
  chatCircle: ChatCircleIcon,
  "chat-circle": ChatCircleIcon,
  circuitry: CircuitryIcon,
  code: CodeIcon,
  database: DatabaseIcon,
  desktop: DesktopIcon,
  fileCode: FileCodeIcon,
  "file-code": FileCodeIcon,
  files: FilesIcon,
  gitBranch: GitBranchIcon,
  "git-branch": GitBranchIcon,
  graph: GraphIcon,
  hardDrives: HardDrivesIcon,
  "hard-drives": HardDrivesIcon,
  house: HouseIcon,
  list: ListIcon,
  lightning: LightningIcon,
  moon: MoonIcon,
  pause: PauseIcon,
  play: PlayIcon,
  rows: RowsIcon,
  "sidebar-simple": SidebarSimpleIcon,
  sidebarSimple: SidebarSimpleIcon,
  squaresFour: SquaresFourIcon,
  "squares-four": SquaresFourIcon,
  stack: StackIcon,
  sun: SunIcon,
  testTube: TestTubeIcon,
  "test-tube": TestTubeIcon,
  trendUp: TrendUpIcon,
  "trend-up": TrendUpIcon,
  usersThree: UsersThreeIcon,
  "users-three": UsersThreeIcon,
  warningCircle: WarningCircleIcon,
  "warning-circle": WarningCircleIcon,
  x: XIcon,
} as const

export type SystemIconName = keyof typeof systemIcons

interface SystemIconProps extends Omit<IconProps, "children"> {
  name: SystemIconName
  title?: string
}

export function SystemIcon({ name, size = 18, ...props }: SystemIconProps) {
  const IconComponent = systemIcons[name]
  return <IconComponent size={size} {...props} />
}
