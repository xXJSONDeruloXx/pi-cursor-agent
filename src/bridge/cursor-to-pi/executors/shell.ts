import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type {
  ShellArgs,
  ShellResult,
} from "../../../__generated__/agent/v1/shell_exec_pb";
import {
  ShellFailure,
  ShellRejected,
  ShellResult as ShellResultClass,
  ShellSuccess,
} from "../../../__generated__/agent/v1/shell_exec_pb";
import type { Executor } from "../../../vendor/agent-exec";
import { toolResultToText } from "../../shared/tool-result";
import {
  decodeToolCallId,
  type PiToolContext,
} from "../local-resource-provider/types";
import { requestToolExecution } from "../tool-bridge";

export function buildShellResultFromToolResult(
  args: { command: string; workingDirectory: string },
  result: ToolResultMessage,
): ShellResult {
  const output = toolResultToText(result);
  if (result.isError) {
    return new ShellResultClass({
      result: {
        case: "failure",
        value: new ShellFailure({
          command: args.command,
          workingDirectory: args.workingDirectory,
          exitCode: 1,
          signal: "",
          stdout: "",
          stderr: output || "Shell failed",
          executionTime: 0,
          aborted: false,
        }),
      },
    });
  }
  return new ShellResultClass({
    result: {
      case: "success",
      value: new ShellSuccess({
        command: args.command,
        workingDirectory: args.workingDirectory,
        exitCode: 0,
        signal: "",
        stdout: output,
        stderr: "",
        executionTime: 0,
      }),
    },
  });
}

export function buildShellRejectedResult(
  command: string,
  workingDirectory: string,
  reason: string,
): ShellResult {
  return new ShellResultClass({
    result: {
      case: "rejected",
      value: new ShellRejected({
        command,
        workingDirectory,
        reason,
        isReadonly: false,
      }),
    },
  });
}

function isDangerousShellCommand(_command: string): boolean {
  // pi-miyagi fork: always treat commands as safe so callers never prompt.
  // Kept as a function (not inlined) so the upstream shape survives rebases.
  return false;
}

export async function confirmIfDangerous(
  _getCtx: () => ExtensionContext | null,
  _command: string,
): Promise<boolean> {
  // pi-miyagi fork: aggressive YOLO mode. Auto-approve every shell command
  // instead of routing a subset through ctx.ui.confirm. Pi itself does not
  // prompt for tool use, so this makes cursor-agent behave the same.
  return true;
}

export class LocalShellExecutor implements Executor<ShellArgs, ShellResult> {
  private readonly ctx: PiToolContext;

  constructor(ctx: PiToolContext) {
    this.ctx = ctx;
  }

  async execute(_ctx: unknown, args: ShellArgs): Promise<ShellResult> {
    const toolCallId = decodeToolCallId(args.toolCallId);
    const workingDirectory = args.workingDirectory || this.ctx.cwd;

    if (!this.ctx.getActiveTools().has("bash")) {
      return buildShellRejectedResult(
        args.command,
        workingDirectory,
        "Tool not available",
      );
    }

    const approved = await confirmIfDangerous(this.ctx.getCtx, args.command);
    if (!approved) {
      return buildShellRejectedResult(
        args.command,
        workingDirectory,
        "Command rejected",
      );
    }

    const timeoutSeconds =
      args.timeout && args.timeout > 0 ? args.timeout : undefined;

    const piResult = await requestToolExecution(
      this.ctx.getChannel?.() ?? null,
      {
        toolCallId,
        cursorExecType: "shell",
        piToolName: "bash",
        piToolArgs: {
          command: args.command,
          ...(timeoutSeconds != null ? { timeout: timeoutSeconds } : {}),
        },
      },
    );

    return buildShellResultFromToolResult(
      { command: args.command, workingDirectory },
      piResult,
    );
  }
}
