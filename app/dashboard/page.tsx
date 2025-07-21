"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  FileText,
  BarChart3,
  Globe,
  Database,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  Download,
  Calendar,
  Clock,
  HardDrive,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface FileItem {
  id: string
  name: string
  type: "pdf" | "csv" | "web" | "multi"
  size: string
  uploadDate: string
  lastAccessed: string
  status: "processed" | "processing" | "error"
  thumbnail?: string
  description?: string
  processingTime?: string
  insights?: number
}

const mockFiles: FileItem[] = [
  {
    id: "1",
    name: "Financial Report Q4 2024.pdf",
    type: "pdf",
    size: "2.4 MB",
    uploadDate: "2024-01-15",
    lastAccessed: "2 hours ago",
    status: "processed",
    description: "Quarterly financial analysis and performance metrics",
    processingTime: "1.2s",
    insights: 47,
  },
  {
    id: "2",
    name: "Sales Data Analysis.csv",
    type: "csv",
    size: "1.8 MB",
    uploadDate: "2024-01-14",
    lastAccessed: "1 day ago",
    status: "processed",
    description: "Monthly sales performance data with regional breakdown",
    processingTime: "0.8s",
    insights: 23,
  },
  {
    id: "3",
    name: "Market Research Report.pdf",
    type: "pdf",
    size: "5.2 MB",
    uploadDate: "2024-01-13",
    lastAccessed: "2 days ago",
    status: "processed",
    description: "Comprehensive market analysis for Q4 2024",
    processingTime: "2.1s",
    insights: 89,
  },
  {
    id: "4",
    name: "Company Website Analysis",
    type: "web",
    size: "892 KB",
    uploadDate: "2024-01-12",
    lastAccessed: "3 days ago",
    status: "processed",
    description: "Scraped content from competitor website analysis",
    processingTime: "0.5s",
    insights: 34,
  },
  {
    id: "5",
    name: "Customer Survey Results.csv",
    type: "csv",
    size: "3.1 MB",
    uploadDate: "2024-01-11",
    lastAccessed: "4 days ago",
    status: "processing",
    description: "Customer satisfaction survey responses and analytics",
    processingTime: "Processing...",
    insights: 0,
  },
  {
    id: "6",
    name: "Product Documentation.pdf",
    type: "pdf",
    size: "4.7 MB",
    uploadDate: "2024-01-10",
    lastAccessed: "5 days ago",
    status: "processed",
    description: "Technical product specifications and user manual",
    processingTime: "1.8s",
    insights: 67,
  },
  {
    id: "7",
    name: "Multi-Source Research",
    type: "multi",
    size: "8.3 MB",
    uploadDate: "2024-01-09",
    lastAccessed: "1 week ago",
    status: "processed",
    description: "Combined analysis from multiple data sources",
    processingTime: "3.4s",
    insights: 156,
  },
  {
    id: "8",
    name: "Budget Planning 2024.csv",
    type: "csv",
    size: "2.1 MB",
    uploadDate: "2024-01-08",
    lastAccessed: "1 week ago",
    status: "error",
    description: "Annual budget allocation and planning data",
    processingTime: "Failed",
    insights: 0,
  },
  {
    id: "9",
    name: "Industry Trends Report.pdf",
    type: "pdf",
    size: "6.8 MB",
    uploadDate: "2024-01-07",
    lastAccessed: "1 week ago",
    status: "processed",
    description: "Industry analysis and future trend predictions",
    processingTime: "2.7s",
    insights: 112,
  },
  {
    id: "10",
    name: "Competitor Analysis",
    type: "web",
    size: "1.2 MB",
    uploadDate: "2024-01-06",
    lastAccessed: "2 weeks ago",
    status: "processed",
    description: "Web scraping analysis of competitor strategies",
    processingTime: "0.9s",
    insights: 45,
  },
]

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pdf" | "csv" | "web" | "multi">("all")
  const [visibleCount, setVisibleCount] = useState(6)
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date")

  const getFileIcon = (type: FileItem["type"]) => {
    switch (type) {
      case "pdf":
        return FileText
      case "csv":
        return BarChart3
      case "web":
        return Globe
      case "multi":
        return Database
      default:
        return FileText
    }
  }

  const getFileColor = (type: FileItem["type"]) => {
    switch (type) {
      case "pdf":
        return "from-cyan-400/20 to-blue-500/20 border-cyan-400/20"
      case "csv":
        return "from-violet-400/20 to-purple-500/20 border-violet-400/20"
      case "web":
        return "from-emerald-400/20 to-teal-500/20 border-emerald-400/20"
      case "multi":
        return "from-orange-400/20 to-red-500/20 border-orange-400/20"
      default:
        return "from-gray-400/20 to-gray-500/20 border-gray-400/20"
    }
  }

  const getIconColor = (type: FileItem["type"]) => {
    switch (type) {
      case "pdf":
        return "text-cyan-400"
      case "csv":
        return "text-violet-400"
      case "web":
        return "text-emerald-400"
      case "multi":
        return "text-orange-400"
      default:
        return "text-gray-400"
    }
  }

  const getStatusColor = (status: FileItem["status"]) => {
    switch (status) {
      case "processed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "processing":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20"
      case "error":
        return "bg-red-500/10 text-red-400 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
  }

  const filteredFiles = mockFiles
    .filter((file) => {
      const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = selectedFilter === "all" || file.type === selectedFilter
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name)
        case "size":
          return Number.parseFloat(a.size) - Number.parseFloat(b.size)
        case "date":
        default:
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      }
    })

  const visibleFiles = filteredFiles.slice(0, visibleCount)
  const hasMore = visibleCount < filteredFiles.length

  const getTypeCounts = () => {
    return {
      all: mockFiles.length,
      pdf: mockFiles.filter((f) => f.type === "pdf").length,
      csv: mockFiles.filter((f) => f.type === "csv").length,
      web: mockFiles.filter((f) => f.type === "web").length,
      multi: mockFiles.filter((f) => f.type === "multi").length,
    }
  }

  const typeCounts = getTypeCounts()
  const totalInsights = mockFiles.reduce((sum, file) => sum + (file.insights || 0), 0)
  const processedFiles = mockFiles.filter((f) => f.status === "processed").length

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900/20 via-black to-black" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg%3E%3Cg fill=&quot;none&quot; fillRule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%23ffffff&quot; fillOpacity=&quot;0.02&quot;%3E%3Ccircle cx=&quot;30&quot; cy=&quot;30&quot; r=&quot;1&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />

      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-500 to-white bg-clip-text text-transparent mb-3">
                  Dashboard
                </h1>
                <p className="text-gray-400 text-lg">
                  Centralized document analysis and insights management
                </p>
              </div>
              <Button className="bg-gradient-to-r from-blue-600 to-violet-800 cursor-pointer hover:from-blue-800 hover:to-violet-700 text-white border-0 shadow-lg px-6 py-3 h-auto">
                <Plus className="h-5 w-5" />
                Upload Document
              </Button>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                      <HardDrive className="h-6 w-6 text-cyan-400" />
                    </div>
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-1">Total Documents</p>
                    <p className="text-3xl font-bold text-white">{typeCounts.all}</p>
                    <p className="text-emerald-400 text-xs mt-1">+12% this month</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
                      <Activity className="h-6 w-6 text-violet-400" />
                    </div>
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-1">Processed Files</p>
                    <p className="text-3xl font-bold text-white">{processedFiles}</p>
                    <p className="text-emerald-400 text-xs mt-1">98% success rate</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <Zap className="h-6 w-6 text-emerald-400" />
                    </div>
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-1">AI Insights</p>
                    <p className="text-3xl font-bold text-white">{totalInsights}</p>
                    <p className="text-emerald-400 text-xs mt-1">Generated today</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="relative overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <Clock className="h-6 w-6 text-orange-400" />
                    </div>
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm font-medium mb-1">Avg Processing</p>
                    <p className="text-3xl font-bold text-white">1.4s</p>
                    <p className="text-emerald-400 text-xs mt-1">-23% faster</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-6 mb-8">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search documents and data sources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 bg-gray-900/50 backdrop-blur-xl border-gray-800/50 text-white placeholder:text-gray-400 focus:border-cyan-500/50 focus:ring-cyan-500/20 rounded-xl"
                />
              </div>
              <div className="flex gap-3">
                {(["all", "pdf", "csv", "web", "multi"] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={selectedFilter === filter ? "default" : "outline"}
                    onClick={() => setSelectedFilter(filter)}
                    className={
                      selectedFilter === filter
                        ? "bg-gradient-to-r cursor-pointer from-blue-600 to-violet-800 text-white border-0 shadow-lg shadow-cyan-500/25 px-4 h-12"
                        : "border-gray-800/50 cursor-pointer bg-gray-900/30 backdrop-blur-xl text-gray-300 hover:text-white hover:bg-gray-800/50 hover:border-gray-700/50 px-4 h-12"
                    }
                  >
                    {filter.toUpperCase()}
                    <span className="ml-2 text-xs opacity-75">({typeCounts[filter]})</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Files Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
            {visibleFiles.map((file, index) => {
              const Icon = getFileIcon(file.type)
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 hover:border-gray-700/50 transition-all duration-300"
                >
                  {/* Subtle gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${getFileColor(file.type)} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  <div className="relative">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`p-3 bg-gradient-to-br ${getFileColor(file.type)} rounded-xl border`}>
                        <Icon className={`h-6 w-6 ${getIconColor(file.type)}`} />
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge className={`text-xs font-medium ${getStatusColor(file.status)} border`}>
                          {file.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-800/50"
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-white font-semibold text-lg mb-2 line-clamp-1">{file.name}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">{file.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                      <div className="flex items-center space-x-2 text-gray-400">
                        <HardDrive className="h-4 w-4" />
                        <span>{file.size}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span>{file.processingTime}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400">
                        <Zap className="h-4 w-4" />
                        <span>{file.insights} insights</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                      <div className="text-xs text-gray-500">
                        Last accessed {file.lastAccessed}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 hover:bg-gray-800/50 text-gray-400 hover:text-cyan-400 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 hover:bg-gray-800/50 text-gray-400 hover:text-emerald-400 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 hover:bg-gray-800/50 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center">
              <Button
                onClick={() => setVisibleCount((prev) => prev + 6)}
                variant="outline"
                className="border-gray-800/50 bg-gray-900/30 backdrop-blur-xl text-gray-300 hover:text-white hover:bg-gray-800/50 hover:border-gray-700/50 px-8 py-3 h-auto rounded-xl"
              >
                Load More Documents
                <span className="ml-2 text-sm opacity-75">
                  ({filteredFiles.length - visibleCount} remaining)
                </span>
              </Button>
            </div>
          )}

          {/* Empty State */}
          {filteredFiles.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 flex items-center justify-center mx-auto mb-6">
                <Search className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-white font-semibold text-xl mb-3">No documents found</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Try adjusting your search criteria or upload new documents to get started
              </p>
              <Button
                onClick={() => {
                  setSearchQuery("")
                  setSelectedFilter("all")
                }}
                variant="outline"
                className="border-gray-800/50 bg-gray-900/30 backdrop-blur-xl text-gray-300 hover:text-white hover:bg-gray-800/50 hover:border-gray-700/50 px-6 py-3 h-auto rounded-xl"
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
