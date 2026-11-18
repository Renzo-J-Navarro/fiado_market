'use client';
import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, PackagePlus } from 'lucide-react';
import Shell from '@/components/Shell';
import Field, { btnCls, Msg } from '@/components/Field';
import { api, post, money } from '@/lib/api';

type Product = {
  id: number;
  nombre: string;
  imagen_url: string | null;
  precio_contado: number;
  precio_lista: number;
  permite_fin_mes: boolean | number;
  permite_cuotas: boolean | number;
};

export default function Productos() {
  const [list, setList] = useState<Product[]>([]);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setList(await api<Product[]>('/products')); setErr(''); }
    catch (error) { setErr((error as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr(''); setNotice('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const contado = Number(values.get('precioContado'));
    const lista = Number(values.get('precioLista'));
    if (lista < contado) { setErr('El precio de lista no puede ser menor que el precio al contado.'); return; }
    if (values.get('finMes') !== 'on' && values.get('cuotas') !== 'on') { setErr('Activa al menos una modalidad de pago.'); return; }
    try {
      await post('/products', {
        nombre: values.get('nombre'), imagenUrl: values.get('imagenUrl') || null,
        precioContado: contado, precioLista: lista,
        finMes: values.get('finMes') === 'on', cuotas: values.get('cuotas') === 'on',
      });
      form.reset();
      setNotice('Producto agregado al catálogo.');
      await load();
    } catch (error) {
      setErr((error as Error).message);
    }
  }

  return (
    <Shell role="ADMIN" title="Catálogo de productos">
      <div className="workspace-page">
        <p className="workspace-intro">Agrega los productos que vendes. El precio de lista se usará para calcular las compras a crédito.</p>
        <Msg err={err} ok={notice} />
        <div className="workspace-grid workspace-product-grid">
          <form onSubmit={submit} className="workspace-card workspace-form">
            <div className="workspace-card-heading"><span className="workspace-step"><PackagePlus size={18} /></span><div><h2>Nuevo producto</h2><p>Completa la información para agregarlo.</p></div></div>
            <div className="workspace-form-grid">
              <Field label="Nombre del producto" name="nombre" required maxLength={120} help="Nombre que aparecerá en el punto de venta." />
              <Field label="Imagen (URL opcional)" name="imagenUrl" type="url" maxLength={255} placeholder="https://…" help="Pega un enlace público a una imagen del producto." />
              <div className="workspace-form-pair">
                <Field label="Precio al contado (S/)" name="precioContado" type="number" step="0.01" min="0.01" required help="Precio cuando se paga al contado." />
                <Field label="Precio de lista (S/)" name="precioLista" type="number" step="0.01" min="0.01" required help="Precio usado para las ventas a crédito." />
              </div>
              <fieldset className="workspace-options">
                <legend>Modalidades aceptadas</legend>
                <label><input type="checkbox" name="finMes" defaultChecked /> Fin de mes, en un pago</label>
                <label><input type="checkbox" name="cuotas" defaultChecked /> Pago en cuotas</label>
              </fieldset>
            </div>
            <p className="workspace-form-note">El precio de lista debe ser igual o mayor al precio al contado.</p>
            <button className={`${btnCls} workspace-primary-button`}>Agregar producto</button>
          </form>

          <section className="workspace-card workspace-list-card">
            <div className="workspace-card-heading"><span className="workspace-step">{list.length}</span><div><h2>Productos y servicios</h2><p>Precios disponibles para tu tienda.</p></div></div>
            {list.length === 0 ? <div className="workspace-empty"><ImagePlus size={30} /><strong>Tu catálogo está vacío</strong><span>Agrega un producto para usarlo en el punto de venta.</span></div> : (
              <div className="workspace-product-cards">{list.map(product => <article key={product.id} className="workspace-product-card">
                {product.imagen_url
                  ? <img src={product.imagen_url} alt={product.nombre} loading="lazy" className="workspace-product-image" />
                  : <div className="workspace-product-placeholder" aria-label="Sin imagen"><ImagePlus size={28} /></div>}
                <div className="workspace-product-info">
                  <h3>{product.nombre}</h3>
                  <div className="workspace-prices"><span>Contado <strong>S/ {money(Number(product.precio_contado))}</strong></span><span>Crédito <strong>S/ {money(Number(product.precio_lista))}</strong></span></div>
                  <p className="workspace-product-modes">{product.permite_fin_mes ? 'Fin de mes' : ''}{product.permite_fin_mes && product.permite_cuotas ? ' · ' : ''}{product.permite_cuotas ? 'Cuotas' : ''}</p>
                </div>
              </article>)}</div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
