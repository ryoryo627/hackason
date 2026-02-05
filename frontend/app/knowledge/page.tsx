"use client";

import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Badge, Input } from "@/components/ui";
import {
  Upload,
  FileText,
  Search,
  Trash2,
  Loader2,
  Plus,
  X,
  ChevronDown,
} from "lucide-react";
import {
  knowledgeApi,
  KnowledgeDocument,
  KnowledgeCategory,
  SearchResult,
} from "@/lib/api";

const statusConfig: Record<
  string,
  { variant: "success" | "warning" | "danger" | "default"; label: string }
> = {
  indexed: { variant: "success", label: "インデックス済み" },
  processing: { variant: "warning", label: "処理中" },
  error: { variant: "danger", label: "エラー" },
  pending: { variant: "default", label: "待機中" },
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Create document modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: "",
    category: "",
    source: "",
  });

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [docsData, catsData] = await Promise.all([
          knowledgeApi.listDocuments({
            ...(categoryFilter && { category: categoryFilter }),
          }),
          knowledgeApi.listCategories(),
        ]);

        setDocuments(docsData.documents);
        setCategories(catsData.categories);
      } catch (err) {
        console.error("Knowledge fetch error:", err);
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [categoryFilter]);

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const data = await knowledgeApi.search(searchQuery, {
        ...(categoryFilter && { category: categoryFilter }),
        limit: 10,
      });
      setSearchResults(data.results);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

  // Create document
  const handleCreate = async () => {
    if (!newDoc.title || !newDoc.category) return;

    try {
      setCreating(true);
      const result = await knowledgeApi.createDocument(newDoc);

      // Trigger file upload
      setUploadingDocId(result.document_id);
      fileInputRef.current?.click();

      setShowCreateModal(false);
      setNewDoc({ title: "", category: "", source: "" });

      // Refresh list
      const data = await knowledgeApi.listDocuments({
        ...(categoryFilter && { category: categoryFilter }),
      });
      setDocuments(data.documents);
    } catch (err) {
      console.error("Create error:", err);
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingDocId) return;

    try {
      await knowledgeApi.uploadFile(uploadingDocId, file);

      // Refresh list
      const data = await knowledgeApi.listDocuments({
        ...(categoryFilter && { category: categoryFilter }),
      });
      setDocuments(data.documents);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploadingDocId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm("このドキュメントを削除しますか？")) return;

    try {
      await knowledgeApi.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  return (
    <AdminLayout title="ナレッジベース">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.txt,.md,.docx"
        className="hidden"
      />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <p className="text-gray-600 flex-1">
          RAGナレッジベースのドキュメント管理。エージェントが参照する知識を追加・編集できます。
        </p>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          ドキュメント追加
        </Button>
      </div>

      {/* Search & Filter */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="ナレッジを検索..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">すべてのカテゴリ</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                検索
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Search Results */}
      {showSearchResults && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <CardHeader
              title="検索結果"
              description={`「${searchQuery}」で${searchResults.length}件見つかりました`}
            />
            <button
              onClick={() => setShowSearchResults(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              該当するドキュメントが見つかりません
            </p>
          ) : (
            <div className="space-y-3">
              {searchResults.map((result) => (
                <div
                  key={result.document_id}
                  className="p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {result.title}
                    </span>
                    <Badge variant="info" size="sm">
                      {getCategoryName(result.category)}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      スコア: {result.score}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{result.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4 inline" />
          </button>
        </div>
      )}

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            ドキュメントがありません。「ドキュメント追加」から追加してください。
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const status = statusConfig[doc.status] || statusConfig.pending;
            return (
              <Card key={doc.id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <FileText className="w-6 h-6 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="info" size="sm">
                          {getCategoryName(doc.category)}
                        </Badge>
                        <Badge variant={status.variant} size="sm">
                          {status.label}
                        </Badge>
                        {doc.total_chunks > 0 && (
                          <span className="text-sm text-gray-500">
                            {doc.total_chunks}チャンク
                          </span>
                        )}
                      </div>
                      {doc.source && (
                        <p className="text-sm text-gray-500 mt-1">
                          出典: {doc.source}
                        </p>
                      )}
                      {doc.file_name && (
                        <p className="text-xs text-gray-400 mt-1">
                          ファイル: {doc.file_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">ドキュメント追加</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル *
                </label>
                <Input
                  value={newDoc.title}
                  onChange={(e) =>
                    setNewDoc({ ...newDoc, title: e.target.value })
                  }
                  placeholder="ドキュメントタイトル"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カテゴリ *
                </label>
                <div className="relative">
                  <select
                    value={newDoc.category}
                    onChange={(e) =>
                      setNewDoc({ ...newDoc, category: e.target.value })
                    }
                    className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">カテゴリを選択</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  出典
                </label>
                <Input
                  value={newDoc.source}
                  onChange={(e) =>
                    setNewDoc({ ...newDoc, source: e.target.value })
                  }
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
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
