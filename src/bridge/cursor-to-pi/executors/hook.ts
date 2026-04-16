import { appendFileSync } from "node:fs";
import type {
  ExecuteHookArgs,
  ExecuteHookResult,
} from "../../../__generated__/agent/v1/exec_pb";
import {
  ExecuteHookResponse,
  ExecuteHookResult as ExecuteHookResultClass,
  PreCompactRequestResponse,
} from "../../../__generated__/agent/v1/exec_pb";
import {
  SubagentStartRequestResponse,
  SubagentStopRequestResponse,
} from "../../../__generated__/agent/v1/subagents_pb";
import type { Executor } from "../../../vendor/agent-exec";

// Optional instrumentation: set PI_CURSOR_AGENT_HOOK_LOG to a file path to
// capture every execute-hook invocation (useful for probing Cursor's
// preCompact cadence without patching the build).
const DIAG_LOG = process.env.PI_CURSOR_AGENT_HOOK_LOG;

function logHook(entry: Record<string, unknown>): void {
  if (!DIAG_LOG) return;
  try {
    appendFileSync(
      DIAG_LOG,
      `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`,
    );
  } catch {
    // Never let logging break the hook.
  }
}

export class LocalHookExecutorImpl
  implements Executor<ExecuteHookArgs, ExecuteHookResult>
{
  async execute(
    _ctx: unknown,
    args: ExecuteHookArgs,
  ): Promise<ExecuteHookResult> {
    const request = args.request;

    if (!request) {
      logHook({ kind: "empty-request" });
      return new ExecuteHookResultClass({});
    }

    switch (request.request.case) {
      case "preCompact": {
        const q = request.request.value;
        logHook({
          kind: "preCompact",
          trigger: q.trigger,
          contextTokens: Number(q.contextTokens),
          contextWindowSize: Number(q.contextWindowSize),
          contextUsagePercent: q.contextUsagePercent,
          messageCount: q.messageCount,
          messagesToCompact: q.messagesToCompact,
          isFirstCompaction: q.isFirstCompaction,
          model: q.model,
          conversationId: q.conversationId,
        });
        return new ExecuteHookResultClass({
          response: new ExecuteHookResponse({
            response: {
              case: "preCompact",
              value: new PreCompactRequestResponse(),
            },
          }),
        });
      }

      case "subagentStart":
        logHook({ kind: "subagentStart" });
        return new ExecuteHookResultClass({
          response: new ExecuteHookResponse({
            response: {
              case: "subagentStart",
              value: new SubagentStartRequestResponse(),
            },
          }),
        });

      case "subagentStop":
        logHook({ kind: "subagentStop" });
        return new ExecuteHookResultClass({
          response: new ExecuteHookResponse({
            response: {
              case: "subagentStop",
              value: new SubagentStopRequestResponse(),
            },
          }),
        });

      default:
        logHook({ kind: "unknown", case: request.request.case });
        return new ExecuteHookResultClass({});
    }
  }
}
