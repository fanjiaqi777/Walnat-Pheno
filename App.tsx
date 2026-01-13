import React, { useState } from 'react';
import { analyzeWalnutImage, AnalysisResult } from './services/geminiService';
import EdgeDetector, { ViewMode, PhenotypicData } from './components/EdgeDetector';
import { 
  ArrowUpTrayIcon, 
  CpuChipIcon, 
  EyeIcon, 
  SparklesIcon, 
  PhotoIcon,
  PencilSquareIcon,
  QrCodeIcon,
  BeakerIcon,
  ArrowDownTrayIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

type Language = 'en' | 'zh';

function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const [language, setLanguage] = useState<Language>('zh');
  
  // Scientific Data State
  const [isScientificMode, setIsScientificMode] = useState(false);
  const [phenotypes, setPhenotypes] = useState<PhenotypicData | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setAnalysis(null);
        setPhenotypes(null);
        setViewMode('original');
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhenotypeCalculation = (data: PhenotypicData) => {
    setPhenotypes(data);
  };

  const runAnalysis = async () => {
    if (!selectedImage) return;
    
    setLoading(true);
    // If science mode is on, we prefer Mask mode as it shows the data source best, otherwise Overlay
    setViewMode(isScientificMode ? 'mask' : 'overlay'); 

    try {
      const result = await analyzeWalnutImage(selectedImage);
      setAnalysis(result);
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadData = () => {
    if (!phenotypes && !analysis) return;
    
    const data = {
        timestamp: new Date().toISOString(),
        sampleId: "sample_" + Date.now().toString().slice(-6),
        // Computer Vision Metrics (Hard Math)
        computational_phenotypes: phenotypes ? {
            fractal_dimension: parseFloat(phenotypes.fractalDimension.toFixed(4)),
            groove_density: parseFloat(phenotypes.grooveDensity.toFixed(4)),
        } : null,
        // AI Estimated Metrics (Semantic/Visual)
        visual_phenotypes: analysis ? {
            morphology: analysis.morphology.en,
            texture_type: analysis.textureType.en,
            rugosity_index: analysis.rugosityIndex,
            ridge_continuity: analysis.ridgeContinuity,
            visual_depth: analysis.visualDepthScore
        } : null
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phenotypes_${Date.now()}.json`;
    a.click();
  };

  // Static Labels dictionary
  const labels = {
    reportTitle: { en: 'Phenotypic Analysis', zh: '表型特征分析' },
    scienceTitle: { en: 'Comp. Vision Metrics', zh: '计算机视觉指标' },
    morphology: { en: 'Morphology', zh: '形态分类' },
    textureType: { en: 'Texture Class', zh: '纹理类型' },
    rugosity: { en: 'Rugosity Index', zh: '褶皱度指数' },
    continuity: { en: 'Ridge Continuity', zh: '纹理连贯性' },
    depth: { en: 'Visual Depth', zh: '视觉深度' },
    descTitle: { en: 'Observation', zh: '表型描述' },
    placeholder: { 
      en: 'Upload a specimen image to extract quantitative traits for genomic association.', 
      zh: '上传样本图片以提取用于基因组关联分析的量化特征。' 
    },
    processing: { en: 'Extracting Traits...', zh: '正在提取表型特征...' },
    btnAnalyze: { en: 'Extract Phenotypes', zh: '提取表型数据' },
    scienceMode: { en: 'Research Mode', zh: '科研模式' }
  };

  // Helper to render a progress bar for 1-10 metrics
  const MetricBar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="mb-3">
        <div className="flex justify-between items-end mb-1">
            <span className="text-xs text-slate-400 font-mono uppercase">{label}</span>
            <span className={`text-sm font-bold font-mono ${colorClass}`}>{value}/10</span>
        </div>
        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <div 
                className={`h-full rounded-full transition-all duration-1000 ${colorClass.replace('text-', 'bg-')}`} 
                style={{ width: `${value * 10}%` }}
            ></div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Header & Display */}
        <div className="flex flex-col space-y-6">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
                <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <BeakerIcon className="w-8 h-8 text-cyan-400" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Walnut Pheno
                </h1>
                </div>
                <p className="text-slate-400 text-sm">
                Quantitative Phenotyping for *Juglans* Genomics.
                </p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                 <span className={`text-xs font-medium px-2 ${isScientificMode ? 'text-cyan-400' : 'text-slate-400'}`}>
                     {labels.scienceMode[language]}
                 </span>
                 <button 
                    onClick={() => setIsScientificMode(!isScientificMode)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isScientificMode ? 'bg-cyan-600' : 'bg-slate-600'}`}
                 >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isScientificMode ? 'translate-x-5' : 'translate-x-1'}`} />
                 </button>
            </div>
          </header>

          {/* Visualizer Area */}
          <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700 min-h-[400px] flex flex-col justify-center items-center relative group">
            
            {!selectedImage ? (
              <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-all duration-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ArrowUpTrayIcon className="w-12 h-12 text-slate-500 mb-4 group-hover:text-cyan-400 transition-colors" />
                  <p className="mb-2 text-sm text-slate-400">
                    <span className="font-semibold text-cyan-500">Click to upload</span> specimen
                  </p>
                  <p className="text-xs text-slate-500">Standardized Background (PNG, JPG)</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 relative flex items-center justify-center">
                   <EdgeDetector 
                     key={selectedImage}
                     imageSrc={selectedImage} 
                     mode={viewMode}
                     onPhenotypesCalculated={handlePhenotypeCalculation}
                   />
                </div>
                
                {/* Controls */}
                <div className="mt-4 grid grid-cols-2 sm:flex sm:flex-row justify-between items-center bg-slate-900/50 p-2 rounded-lg gap-3">
                   <div className="col-span-2 sm:col-span-1 flex flex-wrap gap-2 bg-slate-800/80 p-1 rounded-lg justify-center sm:justify-start">
                      <button 
                        onClick={() => setViewMode('original')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${viewMode === 'original' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <PhotoIcon className="w-4 h-4" /> Orig
                      </button>
                      <button 
                        onClick={() => setViewMode('overlay')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${viewMode === 'overlay' ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <EyeIcon className="w-4 h-4" /> Tex
                      </button>
                      <button 
                        onClick={() => setViewMode('sketch')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${viewMode === 'sketch' ? 'bg-gray-200 text-gray-900 border border-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <PencilSquareIcon className="w-4 h-4" /> Sketch
                      </button>
                      <button 
                        onClick={() => setViewMode('mask')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${viewMode === 'mask' ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                      >
                        <QrCodeIcon className="w-4 h-4" /> Mask
                      </button>
                   </div>
                   
                   <button 
                     onClick={() => setSelectedImage(null)}
                     className="col-span-2 sm:col-span-1 text-xs text-red-400 hover:text-red-300 underline px-2 text-center sm:text-right"
                   >
                     Reset Specimen
                   </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          {selectedImage && !loading && !analysis && (
            <button
              onClick={runAnalysis}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-lg shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <SparklesIcon className="w-6 h-6" />
              {labels.btnAnalyze[language]}
            </button>
          )}
          
          {loading && (
             <div className="w-full py-4 bg-slate-800 rounded-xl font-medium text-slate-400 flex items-center justify-center gap-2 animate-pulse">
              <CpuChipIcon className="w-6 h-6 animate-spin" />
              {labels.processing[language]}
            </div>
          )}
        </div>

        {/* Right Column: Analysis Results */}
        <div className="flex flex-col h-full space-y-4">
           
           {/* Scientific Data Panel (Visible in Research Mode) */}
           {isScientificMode && (
              <div className="bg-slate-900/80 rounded-2xl p-6 border border-cyan-500/30 shadow-lg shadow-cyan-900/10 relative overflow-hidden animate-fadeIn">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                     <BeakerIcon className="w-32 h-32 text-cyan-400" />
                 </div>
                 
                 <div className="flex justify-between items-center mb-6 z-10 relative">
                     <h2 className="text-xl font-mono font-semibold text-cyan-400 flex items-center gap-2">
                        <CpuChipIcon className="w-5 h-5" />
                        {labels.scienceTitle[language]}
                     </h2>
                     {(phenotypes || analysis) && (
                        <button onClick={downloadData} className="text-xs flex items-center gap-1 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-200 px-3 py-1 rounded border border-cyan-700 transition-colors">
                            <ArrowDownTrayIcon className="w-3 h-3" /> Export JSON
                        </button>
                     )}
                 </div>

                 {!phenotypes ? (
                    <div className="text-slate-500 text-sm font-mono p-4 border border-dashed border-slate-700 rounded-lg text-center">
                        Waiting for algorithmic extraction...
                    </div>
                 ) : (
                    <div className="grid grid-cols-2 gap-4 z-10 relative">
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <div className="text-xs text-slate-500 font-mono mb-1">FRACTAL DIMENSION (D)</div>
                            <div className="text-2xl font-mono font-bold text-white">{phenotypes.fractalDimension.toFixed(4)}</div>
                            <div className="text-[10px] text-slate-600 mt-2">Box-Counting Method</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <div className="text-xs text-slate-500 font-mono mb-1">GROOVE DENSITY (ρ)</div>
                            <div className="text-2xl font-mono font-bold text-white">{(phenotypes.grooveDensity * 100).toFixed(2)}%</div>
                            <div className="text-[10px] text-slate-600 mt-2">Surface Ratio</div>
                        </div>
                    </div>
                 )}
              </div>
           )}

           <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex-1 flex flex-col relative overflow-hidden">
              {/* Header with Language Toggle */}
              <div className="flex items-center justify-between mb-6 z-10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="w-2 h-8 bg-cyan-500 rounded-full"></span>
                  {labels.reportTitle[language]}
                </h2>
                
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                  <button 
                    onClick={() => setLanguage('en')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${language === 'en' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    EN
                  </button>
                  <button 
                    onClick={() => setLanguage('zh')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${language === 'zh' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    中文
                  </button>
                </div>
              </div>

              {!analysis ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4 opacity-50">
                   <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                      <ChartBarIcon className="w-10 h-10" />
                   </div>
                   <p className="text-center max-w-xs">
                     {labels.placeholder[language]}
                   </p>
                </div>
              ) : (
                <div className="space-y-6 animate-fadeIn z-10">
                   
                   {/* Main Categorization */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                         <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{labels.morphology[language]}</div>
                         <div className="text-lg font-bold text-cyan-300">{analysis.morphology[language]}</div>
                      </div>
                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                         <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{labels.textureType[language]}</div>
                         <div className="text-lg font-bold text-blue-300">{analysis.textureType[language]}</div>
                      </div>
                   </div>

                   {/* Quantitative Traits (Metrics) */}
                   <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <BeakerIcon className="w-4 h-4 text-cyan-500" />
                        AI Estimated Traits
                      </h3>
                      
                      <MetricBar 
                        label={labels.rugosity[language]} 
                        value={analysis.rugosityIndex} 
                        colorClass="text-purple-400" 
                      />
                      <MetricBar 
                        label={labels.continuity[language]} 
                        value={analysis.ridgeContinuity} 
                        colorClass="text-emerald-400" 
                      />
                      <MetricBar 
                        label={labels.depth[language]} 
                        value={analysis.visualDepthScore} 
                        colorClass="text-amber-400" 
                      />
                   </div>

                   {/* Scientific Description */}
                   <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">{labels.descTitle[language]}</h3>
                      <p className="text-slate-300 leading-relaxed text-sm bg-slate-700/30 p-4 rounded-lg border-l-4 border-cyan-500 font-serif">
                        "{analysis.phenotypicDescription[language]}"
                      </p>
                   </div>

                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}

export default App;