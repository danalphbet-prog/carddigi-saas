import React, {useMemo, useRef, useState} from 'react';
import {productCollection, store} from './firebase.js';
import {EXAMPLE_PRODUCT, PRODUCT_KEYS, MAX_PRODUCTS_PER_FILE, downloadProducts, normalizeProduct, productKey, readProductsFile} from './product-interchange.js';
import './product-file-tools.css';

const filename = (prefix, type) => prefix + '.' + type;
function Action({children, onClick, disabled = false}) {return <button type="button" className="mf-btn" onClick={onClick} disabled={disabled}>{children}</button>;}
function readableError(e) {return e instanceof Error ? e.message : 'Não foi possível processar o arquivo.';}
function TemplateActions({onError, disabled}) {
  const example = type => {try {downloadProducts([EXAMPLE_PRODUCT], type, filename('mezzira-modelo-produtos', type));} catch(e) {onError(readableError(e));}};
  return <div className="mf-actions"><Action disabled={disabled} onClick={()=>example('json')}>Baixar modelo JSON</Action><Action disabled={disabled} onClick={()=>example('xml')}>Baixar modelo XML</Action></div>;
}

/** Anexa um arquivo a um produto em edição. Apenas preenche: salvar continua sendo ação explícita. */
export function ProductEditorFileTools({value, onImport, disabled = false}) {
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');setMessage('');setPreview(null);
    try {
      const rows = await readProductsFile(file);
      if (rows.length !== 1) throw new Error('Este formulário recebe apenas 1 produto. Para vários, use Produtos → Importar catálogo.');
      setPreview(rows[0]);
    } catch(err) {setError(readableError(err));}
  };
  const exportCurrent = format => {
    setError('');setMessage('');
    try {
      const draft = Object.fromEntries(PRODUCT_KEYS.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]));
      for (const key of ['price','kcal','diameter','roughness']) draft[key] = Number(draft[key]);
      if (draft.stock !== null && draft.stock !== undefined) draft.stock = Number(draft.stock);
      const data = normalizeProduct({...draft, ingredients: draft.ingredients || [], referencePhotos: draft.referencePhotos || []});
      downloadProducts([data], format, filename('mezzira-produto', format));
      setMessage('Arquivo ' + format.toUpperCase() + ' gerado com os dados atuais do formulário.');
    } catch(err) {setError(readableError(err));}
  };
  return <section className="mf-panel mf-in-editor span-2" aria-label="Importar e exportar produto">
    <div className="mf-heading"><strong>Arquivo do produto</strong><span>JSON / XML</span></div>
    <p>Preencha os campos por arquivo ou exporte este produto. Importar não salva automaticamente.</p>
    <div className="mf-actions"><Action disabled={disabled} onClick={()=>input.current?.click()}>Importar JSON / XML</Action><Action disabled={disabled} onClick={()=>exportCurrent('json')}>Exportar JSON</Action><Action disabled={disabled} onClick={()=>exportCurrent('xml')}>Exportar XML</Action></div>
    <TemplateActions disabled={disabled} onError={setError}/>
    <input ref={input} type="file" accept=".json,.xml,application/json,application/xml,text/xml" onChange={selectFile} hidden aria-label="Selecionar JSON ou XML do produto" />
    {preview && <div className="mf-preview"><b>Prévia: {preview.name}</b><small>{preview.cat} · {preview.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}{preview.photo?' · imagem incluída':''}</small><div className="mf-actions"><button type="button" disabled={disabled} className="mf-btn mf-confirm" onClick={()=>{onImport(preview);setPreview(null);setMessage('Dados aplicados. Confira os campos e toque em Salvar produto.');}}>Aplicar no formulário</button><Action onClick={()=>setPreview(null)}>Cancelar</Action></div></div>}
    {error && <p className="mf-error" role="alert">{error}</p>}{message && <p className="mf-message" role="status">{message}</p>}
  </section>;
}

/** Importação em lote sem exclusão nem sobrescrita; grava cada item pela API V13. */
export function ProductCatalogTools({rid, products = [], models = []}) {
  const input = useRef(null);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState([]);
  const [exportPage, setExportPage] = useState(0);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const existing = useMemo(()=>new Set(products.map(productKey).concat(done)), [products, done]);
  const candidates = useMemo(()=>{
    if (!selected) return [];
    const seen = new Set(existing);
    return selected.filter(p => {const key = productKey(p); if (seen.has(key)) return false; seen.add(key); return true;});
  },[selected, existing]);
  const skipped = selected ? selected.length - candidates.length : 0;
  const chooseFile = async e => {
    const file = e.target.files?.[0];e.target.value='';
    if (!file) return;
    setError('');setMessage('');setSelected(null);
    try {
      const rows = await readProductsFile(file);
      const unavailable = rows.find(p => p.modelId && !models.some(m => m.id === p.modelId && m.active));
      if (unavailable) throw new Error('O modelo 3D "' + unavailable.modelId + '" de "' + unavailable.name + '" não está disponível. Remova o modelId do arquivo ou selecione um modelo ativo.');
      setSelected(rows);setDone([]);
    } catch(err) {setError(readableError(err));}
  };
  const exportCatalog = format => {
    setError('');setMessage('');
    try {
      if (!products.length) throw new Error('Cadastre pelo menos um produto antes de exportar o catálogo.');
      const pages = Math.ceil(products.length / MAX_PRODUCTS_PER_FILE);
      const page = Math.min(exportPage, pages - 1);
      const batch = products.slice(page * MAX_PRODUCTS_PER_FILE, (page + 1) * MAX_PRODUCTS_PER_FILE);
      downloadProducts(batch, format, filename('mezzira-catalogo-' + rid + '-lote-' + (page + 1), format));
      setMessage('Lote ' + (page + 1) + ' de ' + pages + ' exportado em ' + format.toUpperCase() + ' (' + batch.length + ' produtos).');
    } catch(err) {setError(readableError(err));}
  };
  const confirmImport = async () => {
    if (!candidates.length || working) return;
    const rows = [...candidates];setWorking(true);setError('');setMessage('');
    let count = 0;
    try {
      for (const p of rows) {
        await store.addDoc(productCollection(rid), p);
        const key = productKey(p);
        setDone(prev => prev.includes(key) ? prev : [...prev, key]);
        count++;
      }
      setSelected(null);setDone([]);
      setMessage(count + ' produto(s) criado(s) pela API. ' + skipped + ' duplicado(s) ignorado(s).');
    } catch(err) {
      setError(count + ' produto(s) salvo(s) antes da falha. A lista não salva continua disponível. ' + readableError(err));
    } finally {setWorking(false);}
  };
  return <section className="mf-panel mf-catalog" aria-label="Arquivos do catálogo de produtos">
    <div className="mf-heading"><strong>Importar e exportar catálogo</strong><span>JSON / XML</span></div>
    <p>Crie vários produtos por arquivo ou faça uma cópia do catálogo. O sistema ignora nomes e categorias repetidos; não substitui nem exclui produtos existentes.</p>
    <div className="mf-actions"><button type="button" disabled={working} className="mf-btn mf-confirm" onClick={()=>input.current?.click()}>Importar catálogo</button><Action disabled={working} onClick={()=>exportCatalog('json')}>Exportar JSON</Action><Action disabled={working} onClick={()=>exportCatalog('xml')}>Exportar XML</Action></div>
    {products.length > MAX_PRODUCTS_PER_FILE && <label className="mf-export-page">Lote para exportar <select value={Math.min(exportPage,Math.ceil(products.length/MAX_PRODUCTS_PER_FILE)-1)} onChange={e=>setExportPage(Number(e.target.value))}>{Array.from({length:Math.ceil(products.length/MAX_PRODUCTS_PER_FILE)},(_,i)=><option key={i} value={i}>Lote {i+1} — produtos {i*MAX_PRODUCTS_PER_FILE+1} a {Math.min(products.length,(i+1)*MAX_PRODUCTS_PER_FILE)}</option>)}</select></label>}
    <TemplateActions disabled={working} onError={setError}/>
    <input ref={input} type="file" accept=".json,.xml,application/json,application/xml,text/xml" onChange={chooseFile} hidden aria-label="Selecionar arquivo de catálogo" />
    {selected && <div className="mf-preview"><b>Conferência antes da importação</b><p>{selected.length} no arquivo · {candidates.length} novo(s) · {skipped} repetido(s) ignorado(s).</p><ul>{candidates.slice(0,8).map((p,i)=><li key={productKey(p)+'-'+i}><span>{p.name}</span><small>{p.cat} · {p.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}{p.photo?' · com foto':''}</small></li>)}</ul>{candidates.length>8&&<small>+ {candidates.length-8} outros produtos</small>}<div className="mf-actions"><button type="button" className="mf-btn mf-confirm" disabled={working||!candidates.length} onClick={confirmImport}>{working?'Salvando pela API…':'Confirmar importação ('+candidates.length+')'}</button><Action disabled={working} onClick={()=>{setSelected(null);setDone([]);}}>Cancelar</Action></div></div>}
    {error&&<p role="alert" className="mf-error">{error}</p>}{message&&<p role="status" className="mf-message">{message}</p>}
    <small className="mf-help">Máximo de {MAX_PRODUCTS_PER_FILE} produtos por arquivo · até 30 MB · fotos JPEG/WebP Base64 · preço decimal com ponto (49.90).</small>
  </section>;
}
