"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Input,
  Alert,
  Modal,
  Select,
  EmptyState,
} from "@/components/ui";
import {
  Upload,
  FileText,
  Search,
  Trash2,
  Loader2,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Scissors,
  Link2,
  Check,
  ExternalLink,
} from "lucide-react";
import { knowledgeApi } from "@/lib/api";
import {
  useKnowledgeDocuments,
  useKnowledgeCategories,
  useKnowledgeChunks,
  useKnowledgeSearch,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";

const statusConfig: Record<
  string,
  { variant: "success" | "warning" | "danger" | "default"; label: string }
> = {
  indexed: { variant: "success", label: "インデックス済み" },
  processing: { variant: "warning", label: "処理中" },
  error: { variant: "danger", label: "エラー" },
  pending: { variant: "default", label: "待機中" },
};

const AGENT_OPTIONS = [
  { id: "intake", label: "Intake" },
  { id: "context", label: "Context" },
  { id: "alert", label: "Alert" },
  { id: "summary", label: "Summary" },
];

export function KnowledgeTab() {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: "",
    category: "",
    source: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Chunk viewer state
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [expandedChunkIdx, setExpandedChunkIdx] = useState<number | null>(null);

  // Agent binding state
  const [savingBindings, setSavingBindings] = useState<string | null>(null);

  // SWR hooks
  const {
    data: docsData,
    isLoading: loading,
    mutate: mutateDocs,
  } = useKnowledgeDocuments(categoryFilter || undefined);
  const documents = docsData?.documents ?? [];

  const { data: catsData } = useKnowledgeCategories();
  const categories = catsData?.categories ?? [];

  const { data: chunksData, isLoading: loadingChunks } =
    useKnowledgeChunks(expandedDocId);
  const chunks = chunksData?.chunks ?? [];

  const { data: searchData, isLoading: searching } = useKnowledgeSearch(
    debouncedSearch.trim(),
    categoryFilter || undefined
  );
  const searchResults = searchData?.results ?? [];
  const showSearchResults = debouncedSearch.trim().length > 0;

  const handleCreate = async () => {
    if (!newDoc.title || !newDoc.category) return;

    try {
      setCreating(true);
      const result = await knowledgeApi.createDocument(newDoc);

      setUploadingDocId(result.document_id);
      fileInputRef.current?.click();

      setShowCreateModal(false);
      setNewDoc({ title: "", category: "", source: "" });

      await mutateDocs();
    } catch (err) {
      console.error("Create error:", err);
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocId) return;

    try {
      setUploadProgress("アップロード中...");
      await knowledgeApi.uploadFile(uploadingDocId, file);
      setUploadProgress(null);

      showSuccess("ファイルのインデックスが完了しました");
      await mutateDocs();
    } catch (err) {
      console.error("Upload error:", err);
      setUploadProgress(null);
      setError(
        err instanceof Error ? err.message : "アップロードに失敗しました"
      );
    } finally {
      setUploadingDocId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("このドキュメントを削除しますか？")) return;

    try {
      await knowledgeApi.deleteDocument(docId);
      if (expandedDocId === docId) {
        setExpandedDocId(null);
      }
      await mutateDocs();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const handleToggleChunks = (docId: string) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
      setExpandedChunkIdx(null);
    } else {
      setExpandedDocId(docId);
      setExpandedChunkIdx(null);
    }
  };

  const handleBindingChange = async (
    docId: string,
    agentId: string,
    currentBindings: string[]
  ) => {
    const newBindings = currentBindings.includes(agentId)
      ? currentBindings.filter((id) => id !== agentId)
      : [...currentBindings, agentId];

    try {
      setSavingBindings(docId);
      await knowledgeApi.updateAgentBindings(docId, newBindings);
      await mutateDocs();
      showSuccess("エージェント連携を更新しました");
    } catch (err) {
      console.error("Binding update error:", err);
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingBindings(null);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  const categoryOptions = [
    { value: "", label: "すべてのカテゴリ" },
    ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
  ];

  const modalCategoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
  }));

  // Stats
  const totalDocs = documents.length;
  const totalChunks = documents.reduce((sum, d) => sum + (d.total_chunks || 0), 0);
  const uniqueCategories = new Set(documents.map((d) => d.category)).size;
  const linkedAgents = new Set(
    documents.flatMap((d) => d.agent_bindings || [])
  ).size;

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.txt,.md,.docx"
        className="hidden"
      />

      {/* Stats Overview */}
      {totalDocs > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bg-tertiary rounded-lg">
                <FileText className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <p className="text-xs text-text-tertiary">ドキュメント</p>
                <p className="text-xl font-bold text-text-primary">{totalDocs}件</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bg-tertiary rounded-lg">
                <Scissors className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <p className="text-xs text-text-tertiary">総チャンク</p>
                <p className="text-xl font-bold text-text-primary">{totalChunks}件</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bg-tertiary rounded-lg">
                <Search className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <p className="text-xs text-text-tertiary">カテゴリ</p>
                <p className="text-xl font-bold text-text-primary">{uniqueCategories}種</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-bg-tertiary rounded-lg">
                <Link2 className="w-5 h-5 text-text-secondary" />
              </div>
              <div>
                <p className="text-xs text-text-tertiary">エージェント</p>
                <p className="text-xl font-bold text-text-primary">{linkedAgents}/4 連携</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <p className="text-text-secondary flex-1">
          AIが参照する資料を管理します。アップロードした資料はAIが回答時に自動的に参照します。
        </p>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          資料を追加
        </Button>
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <Alert variant="info">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{uploadProgress}</span>
          </div>
        </Alert>
      )}

      {/* Success Message */}
      {successMessage && (
        <Alert variant="success" dismissible onDismiss={() => setSuccessMessage(null)}>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            {successMessage}
          </div>
        </Alert>
      )}

      {/* Search & Filter */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <Input
              placeholder="資料を検索..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              options={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          </div>
          {searching && (
            <div className="flex items-center">
              <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
            </div>
          )}
        </div>
      </Card>

      {/* Search Results */}
      {showSearchResults && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardHeader
              title="検索結果"
              description={`「${debouncedSearch}」で${searchResults.length}件見つかりました`}
            />
            <button
              onClick={() => setSearchQuery("")}
              className="text-text-tertiary hover:text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-text-secondary text-center py-4">
              該当する資料が見つかりません
            </p>
          ) : (
            <div className="space-y-3">
              {searchResults.map((result, idx) => {
                const scorePct = Math.min(Math.round(result.score * 100), 100);
                return (
                  <div
                    key={`${result.document_id}-${idx}`}
                    className="p-3 bg-bg-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-text-primary">
                        {result.title || "無題"}
                      </span>
                      <Badge variant="info" size="sm">
                        {getCategoryName(result.category)}
                      </Badge>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-500 rounded-full"
                            style={{ width: `${scorePct}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-tertiary tabular-nums">
                          {scorePct}%
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-3">
                      {result.snippet}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="資料がありません"
            description="「資料を追加」から、AIに参照させたい資料をアップロードしてください。"
            action={{
              label: "資料を追加",
              onClick: () => setShowCreateModal(true),
            }}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const status = statusConfig[doc.status] || statusConfig.pending;
            const isExpanded = expandedDocId === doc.id;
            const bindings = doc.agent_bindings || [];

            return (
              <Card key={doc.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <button
                      onClick={() => handleToggleChunks(doc.id)}
                      className="p-3 bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-6 h-6 text-text-secondary" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-text-secondary" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-text-primary">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="info" size="sm">
                          {getCategoryName(doc.category)}
                        </Badge>
                        <Badge variant={status.variant} size="sm">
                          {status.label}
                        </Badge>
                        {doc.total_chunks > 0 && (
                          <span className="text-sm text-text-secondary">
                            {doc.total_chunks}チャンク
                          </span>
                        )}
                      </div>
                      {doc.source && (
                        <p className="text-sm text-text-secondary mt-1">
                          出典: {doc.source}
                        </p>
                      )}
                      {doc.file_name && (
                        <p className="text-xs text-text-tertiary mt-1">
                          ファイル: {doc.file_name}
                        </p>
                      )}

                      {/* Agent Bindings */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-xs text-text-tertiary">利用エージェント:</span>
                        {AGENT_OPTIONS.map((agent) => (
                          <button
                            key={agent.id}
                            onClick={() =>
                              handleBindingChange(doc.id, agent.id, bindings)
                            }
                            disabled={savingBindings === doc.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-colors ${
                              bindings.includes(agent.id)
                                ? "bg-accent-50 border-accent-300 text-accent-700"
                                : "bg-bg-secondary border-border text-text-tertiary hover:border-accent-300"
                            }`}
                          >
                            {bindings.includes(agent.id) && (
                              <Check className="w-3 h-3" />
                            )}
                            {agent.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {doc.gcs_uri && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="原本を表示"
                        onClick={async () => {
                          try {
                            const { url } = await knowledgeApi.getDownloadUrl(doc.id);
                            window.open(url, "_blank");
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "ダウンロードに失敗しました");
                          }
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUploadingDocId(doc.id);
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="w-4 h-4 text-danger" />
                    </Button>
                  </div>
                </div>

                {/* Chunk Viewer */}
                {isExpanded && (
                  <div className="mt-4 border-t border-border pt-4">
                    {loadingChunks ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
                      </div>
                    ) : chunks.length === 0 ? (
                      <p className="text-sm text-text-tertiary text-center py-4">
                        チャンクがありません（ファイルをアップロードしてください）
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-text-tertiary mb-2">
                          {chunks.length}チャンク
                        </p>
                        {chunks.map((chunk) => (
                          <div
                            key={chunk.id}
                            className="bg-bg-secondary rounded-md"
                          >
                            <button
                              onClick={() =>
                                setExpandedChunkIdx(
                                  expandedChunkIdx === chunk.chunk_index
                                    ? null
                                    : chunk.chunk_index
                                )
                              }
                              className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-bg-hover transition-colors rounded-md"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono text-text-tertiary shrink-0">
                                  #{chunk.chunk_index}
                                </span>
                                <span className="text-sm text-text-secondary truncate">
                                  {chunk.text.slice(0, 100)}...
                                </span>
                              </div>
                              <span className="text-xs text-text-tertiary shrink-0 ml-2">
                                ~{chunk.token_count}tok
                              </span>
                            </button>
                            {expandedChunkIdx === chunk.chunk_index && (
                              <div className="px-3 pb-3">
                                <p className="text-sm text-text-primary whitespace-pre-wrap bg-white rounded p-3 border border-border">
                                  {chunk.text}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Document Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="資料を追加"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              タイトル *
            </label>
            <Input
              value={newDoc.title}
              onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              placeholder="資料のタイトル"
            />
          </div>

          <Select
            label="カテゴリ *"
            options={modalCategoryOptions}
            value={newDoc.category}
            onChange={(value) => setNewDoc({ ...newDoc, category: value })}
            placeholder="カテゴリを選択"
          />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              出典
            </label>
            <Input
              value={newDoc.source}
              onChange={(e) => setNewDoc({ ...newDoc, source: e.target.value })}
              placeholder="出典元（任意）"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newDoc.title || !newDoc.category}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              作成してファイル選択
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
