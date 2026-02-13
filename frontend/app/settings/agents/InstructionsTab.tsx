"use client";

import { useEffect, useState } from "react";
import { Card, Button, Alert, Textarea } from "@/components/ui";
import {
  Loader2,
  Save,
  RotateCcw,
  CheckCircle,
  Cpu,
  ClipboardPen,
  MessageSquareText,
  ShieldAlert,
  FileText,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
} from "lucide-react";
import { settingsApi } from "@/lib/api";
import { useAgentPrompts } from "@/hooks/useApi";
import { PROMPT_TEMPLATES } from "./PromptTemplates";

interface AgentMeta {
  id: string;
  name: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  description: string;
  helpText: string;
}

const AGENTS: AgentMeta[] = [
  {
    id: "intake",
    name: "報告の整理",
    label: "Intake Agent",
    icon: ClipboardPen,
    iconBg: "bg-accent-50",
    iconColor: "text-accent-600",
    description: "スタッフからの報告をBio/Psycho/Socialに分類します",
    helpText:
      "Slackのスレッドに投稿された報告を読み取り、身体・心理・社会の3つの観点で自動的に整理します。例：「体温37.5℃、食欲低下」→ Bio（身体面）に分類",
  },
  {
    id: "context",
    name: "質問への回答",
    label: "Context Agent",
    icon: MessageSquareText,
    iconBg: "bg-success-light",
    iconColor: "text-success",
    description: "@botで質問されたときの回答方法を設定します",
    helpText:
      "チャンネルで @bot と呼びかけると、過去の報告を参照して質問に回答します。例：「@bot 先週からの体温の推移は？」→ 過去データを検索して回答",
  },
  {
    id: "alert",
    name: "異変の検知",
    label: "Alert Agent",
    icon: ShieldAlert,
    iconBg: "bg-warning-light",
    iconColor: "text-warning",
    description: "報告から異変やリスクを自動検知します",
    helpText:
      "新しい報告が投稿されるたびに、異変やリスクがないか自動でチェックします。例：急な体重減少、服薬の中断、転倒リスクの増加など",
  },
  {
    id: "summary",
    name: "経過サマリー",
    label: "Summary Agent",
    icon: FileText,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    description: "患者の経過をまとめて表示します",
    helpText:
      "@bot でサマリーを依頼すると、Bio/Psycho/Socialの3軸で経過をまとめます。カンファレンスや申し送りの資料作成に活用できます",
  },
];

export function InstructionsTab() {
  const [error, setError] = useState<string | null>(null);

  const [sharedPrompt, setSharedPrompt] = useState("");
  const [agentPrompts, setAgentPrompts] = useState<Record<string, string>>({});

  const [originalShared, setOriginalShared] = useState("");
  const [originalAgents, setOriginalAgents] = useState<Record<string, string>>(
    {}
  );

  const [savingField, setSavingField] = useState<string | null>(null);
  const [successField, setSuccessField] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Collapsible state for agent cards
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  // Inline help visibility
  const [showSharedHelp, setShowSharedHelp] = useState(false);
  const [showAgentHelp, setShowAgentHelp] = useState<string | null>(null);

  // SWR hook
  const { data: config, isLoading: loading, mutate: mutatePrompts } = useAgentPrompts();

  // Sync SWR data into local editable state
  useEffect(() => {
    if (config) {
      setSharedPrompt(config.shared_prompt);
      setAgentPrompts(config.agent_prompts);
      setOriginalShared(config.shared_prompt);
      setOriginalAgents({ ...config.agent_prompts });
    }
  }, [config]);

  const showSuccess = (field: string) => {
    setSuccessField(field);
    setTimeout(() => setSuccessField(null), 2000);
  };

  const handleSaveShared = async () => {
    try {
      setSavingField("shared");
      setFieldError(null);
      await settingsApi.updateAgentPrompts({ shared_prompt: sharedPrompt });
      setOriginalShared(sharedPrompt);
      showSuccess("shared");
      await mutatePrompts();
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleResetShared = async () => {
    try {
      setSavingField("shared");
      setFieldError(null);
      await settingsApi.resetAgentPrompt();
      await mutatePrompts();
      showSuccess("shared");
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "リセットに失敗しました"
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveAgent = async (agentId: string) => {
    try {
      setSavingField(agentId);
      setFieldError(null);
      await settingsApi.updateAgentPrompts({
        agent_prompts: { [agentId]: agentPrompts[agentId] },
      });
      setOriginalAgents((prev) => ({
        ...prev,
        [agentId]: agentPrompts[agentId],
      }));
      showSuccess(agentId);
      await mutatePrompts();
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleResetAgent = async (agentId: string) => {
    try {
      setSavingField(agentId);
      setFieldError(null);
      await settingsApi.resetAgentPrompt(agentId);
      await mutatePrompts();
      showSuccess(agentId);
    } catch (err) {
      setFieldError(
        err instanceof Error ? err.message : "リセットに失敗しました"
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleApplyTemplate = (templatePrompt: string) => {
    if (isSharedDirty) {
      const confirmed = confirm(
        "現在の共通指示に未保存の変更があります。テンプレートで上書きしますか？"
      );
      if (!confirmed) return;
    }
    setSharedPrompt(templatePrompt);
  };

  const toggleAgent = (agentId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const isSharedDirty = sharedPrompt !== originalShared;
  const isAgentDirty = (agentId: string) =>
    agentPrompts[agentId] !== originalAgents[agentId];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert
          variant="error"
          dismissible
          onDismiss={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {fieldError && (
        <Alert
          variant="error"
          dismissible
          onDismiss={() => setFieldError(null)}
        >
          {fieldError}
        </Alert>
      )}

      {/* Template Picker */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent-600" />
          <h3 className="text-sm font-semibold text-text-primary">
            テンプレートから始める
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROMPT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleApplyTemplate(tpl.prompt)}
              className="text-left p-3 rounded-lg border border-border hover:border-accent-300 hover:bg-accent-50/50 transition-colors group"
            >
              <span className="text-sm font-medium text-text-primary group-hover:text-accent-700">
                {tpl.name}
              </span>
              <p className="text-xs text-text-secondary mt-1">
                {tpl.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Shared Prompt */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-bg-tertiary rounded-lg">
              <Cpu className="w-5 h-5 text-text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                共通指示
                {isSharedDirty && (
                  <span className="ml-2 inline-block w-2 h-2 bg-orange-500 rounded-full" />
                )}
              </h3>
              <p className="text-sm text-text-secondary">
                すべてのAI機能に適用される基本的な指示
              </p>
            </div>
            <button
              onClick={() => setShowSharedHelp(!showSharedHelp)}
              className="p-1 rounded text-text-tertiary hover:text-accent-600 hover:bg-accent-50 transition-colors"
              aria-label="ヘルプを表示"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetShared}
            disabled={savingField === "shared"}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            デフォルトに戻す
          </Button>
        </div>

        {showSharedHelp && (
          <Alert variant="info" className="mb-3" dismissible onDismiss={() => setShowSharedHelp(false)}>
            ここに書いた内容は、すべてのAI機能（報告の整理、質問への回答、異変の検知、経過サマリー）に共通して適用されます。チーム全体の方針や注意事項を記載してください。
          </Alert>
        )}

        <Textarea
          className="h-40"
          value={sharedPrompt}
          onChange={(e) => setSharedPrompt(e.target.value)}
          charCount
        />
        <div className="flex items-center justify-end mt-2">
          <div className="flex items-center gap-2">
            {successField === "shared" && (
              <span className="flex items-center text-success text-sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                保存しました
              </span>
            )}
            <Button
              onClick={handleSaveShared}
              disabled={savingField === "shared" || !isSharedDirty}
              size="sm"
            >
              {savingField === "shared" ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              保存
            </Button>
          </div>
        </div>
      </Card>

      {/* Agent Prompts — Collapsible */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          機能ごとの個別指示
        </h3>
        <div className="space-y-3">
          {AGENTS.map((agent) => {
            const expanded = expandedAgents.has(agent.id);
            const dirty = isAgentDirty(agent.id);
            const Icon = agent.icon;

            return (
              <Card key={agent.id} className="overflow-hidden">
                {/* Collapsed header */}
                <button
                  onClick={() => toggleAgent(agent.id)}
                  className="w-full flex items-center gap-3 text-left"
                  aria-expanded={expanded}
                >
                  <div className={`p-2 ${agent.iconBg} rounded-lg shrink-0`}>
                    <Icon className={`w-5 h-5 ${agent.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-text-primary">
                        {agent.name}
                      </h4>
                      <span className="text-xs text-text-tertiary">
                        {agent.label}
                      </span>
                      {dirty && (
                        <span className="inline-block w-2 h-2 bg-orange-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-sm text-text-secondary truncate">
                      {agent.description}
                    </p>
                  </div>
                  {expanded ? (
                    <ChevronDown className="w-5 h-5 text-text-tertiary shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0" />
                  )}
                </button>

                {/* Expanded content */}
                {expanded && (
                  <div className="mt-4 pt-4 border-t border-border-light">
                    <div className="flex items-center gap-1 mb-2">
                      <button
                        onClick={() =>
                          setShowAgentHelp(
                            showAgentHelp === agent.id ? null : agent.id
                          )
                        }
                        className="p-1 rounded text-text-tertiary hover:text-accent-600 hover:bg-accent-50 transition-colors"
                        aria-label="ヘルプを表示"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-text-tertiary">
                        この機能の説明を見る
                      </span>
                    </div>

                    {showAgentHelp === agent.id && (
                      <Alert
                        variant="info"
                        className="mb-3"
                        dismissible
                        onDismiss={() => setShowAgentHelp(null)}
                      >
                        {agent.helpText}
                      </Alert>
                    )}

                    <Textarea
                      className="h-40"
                      value={agentPrompts[agent.id] || ""}
                      onChange={(e) =>
                        setAgentPrompts((prev) => ({
                          ...prev,
                          [agent.id]: e.target.value,
                        }))
                      }
                      charCount
                    />
                    <div className="flex items-center justify-between mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResetAgent(agent.id)}
                        disabled={savingField === agent.id}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        デフォルト
                      </Button>
                      <div className="flex items-center gap-2">
                        {successField === agent.id && (
                          <span className="flex items-center text-success text-sm">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            保存しました
                          </span>
                        )}
                        <Button
                          onClick={() => handleSaveAgent(agent.id)}
                          disabled={savingField === agent.id || !dirty}
                          size="sm"
                        >
                          {savingField === agent.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Save className="w-4 h-4 mr-1" />
                          )}
                          保存
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
