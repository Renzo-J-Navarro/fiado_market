'use client';
import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, PackagePlus } from 'lucide-react';
import Shell from '@/components/Shell';
import Field, { btnCls, Msg } from '@/components/Field';
import { api, post, money } from '@/lib/api';

type Product = {
  id: number;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  proveedor: string | null;
  unidad_medida: string;
  activo: boolean | number;
  imagen_url: string | null;
  precio_contado: number;
  precio_lista: number;
  permite_fin_mes: boolean | number;
  permite_cuotas: boolean | number;
};

const UNIDADES = ['unidad', 'kg', 'g', 'litro', 'ml', 'paquete', 'caja', 'docena', 'servicio'];

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
        descripcion: values.get('descripcion') || null, marca: values.get('marca') || null,
        proveedor: values.get('proveedor') || null, unidadMedida: values.get('unidadMedida'),
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

  async function setActive(product: Product, activo: boolean) {
    setErr(''); setNotice('');
    try {
      await api(`/products/${product.id}/estado`, { method: 'PATCH', body: JSON.stringify({ activo }) });
      setNotice(activo ? `${product.nombre} vuelve a estar a la venta.` : `${product.nombre} se dio de baja; ya no aparece en el punto de venta.`);
      await load();
    } catch (error) { setErr((error as Error).message); }
  }

  async function remove(product: Product) {
    setErr(''); setNotice('');
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      setNotice(`${product.nombre} se eliminó del catálogo.`);
      await load();
    } catch (error) { setErr((error as Error).message); }
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
              <Field label="Descripción (opcional)" name="descripcion" maxLength={255} help="Presentación o detalle, por ejemplo: botella de 1 L." />
              <div className="workspace-form-pair">
                <Field label="Marca (opcional)" name="marca" maxLength={80} help="Marca comercial del producto." />
                <Field label="Proveedor (opcional)" name="proveedor" maxLength={120} help="Quién te abastece este producto o servicio." />
              </div>
              <Field label="Unidad de medida" name="unidadMedida" options={UNIDADES} defaultValue="unidad" help="Cómo se vende: por unidad, kilo, litro, paquete o como servicio." />
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
                  <h3>{product.nombre}{!product.activo && <small className="workspace-overdue"> · De baja</small>}</h3>
                  {(product.marca || product.descripcion) && <p className="workspace-product-modes">{[product.marca, product.descripcion].filter(Boolean).join(' · ')}</p>}
                  <p className="workspace-product-modes">Por {product.unidad_medida}{product.proveedor ? ` · Proveedor: ${product.proveedor}` : ''}</p>
                  <div className="workspace-prices"><span>Contado <strong>S/ {money(Number(product.precio_contado))}</strong></span><span>Crédito <strong>S/ {money(Number(product.precio_lista))}</strong></span></div>
                  <p className="workspace-product-modes">{product.permite_fin_mes ? 'Fin de mes' : ''}{product.permite_fin_mes && product.permite_cuotas ? ' · ' : ''}{product.permite_cuotas ? 'Cuotas' : ''}</p>
                  <div className="workspace-invite-actions">
                    <button type="button" className="workspace-text-button" onClick={() => setActive(product, !product.activo)}>{product.activo ? 'Dar de baja' : 'Reactivar'}</button>
                    <button type="button" className="workspace-text-button" onClick={() => remove(product)} title="Solo se puede eliminar si no tiene ventas">Eliminar</button>
                  </div>
                </div>
              </article>)}</div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
