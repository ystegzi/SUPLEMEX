// Convierte el texto de la IA en elementos React seguros (sin innerHTML).
// Admite **negritas**, listas con "- " o "1. ", enlaces [texto](url) y enlaces sueltos,
// pero solo a páginas de la tienda o al WhatsApp de SUPLEMEX.

const ENLACE_INTERNO = /^(?:producto|carrito|login|index)\.html(?:\?producto=[a-z0-9-]+)?(?:#[\w-]+)?$/;
const ENLACE_WHATSAPP = /^https:\/\/wa\.me\/\d+(?:\?[^\s]*)?$/;

const PATRON_EN_LINEA = new RegExp([
    String.raw`\*\*([^*]+)\*\*`,
    String.raw`\[([^\]]+)\]\(([^)\s]+)\)`,
    String.raw`(https:\/\/wa\.me\/\d+|(?:producto|carrito|login|index)\.html(?:\?producto=[a-z0-9-]+)?)`,
].join('|'), 'g');

function enlaceSeguro(url) {
    return ENLACE_INTERNO.test(url) || ENLACE_WHATSAPP.test(url);
}

function textoEnlaceSuelto(url) {
    if (url.startsWith('https://wa.me/')) return 'WhatsApp de SUPLEMEX';
    if (url.startsWith('producto.html')) return 'Ver producto';
    if (url.startsWith('carrito.html')) return 'Ir al carrito';
    if (url.startsWith('login.html')) return 'Iniciar sesión';
    return 'Ir a la tienda';
}

function Enlace({ url, children }) {
    const externo = url.startsWith('https://');
    return (
        <a
            className="chatbot-enlace"
            href={url}
            {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
            {children}
        </a>
    );
}

function formatearEnLinea(texto, clave) {
    const partes = [];
    let ultimo = 0;
    let coincidencia;
    PATRON_EN_LINEA.lastIndex = 0;
    while ((coincidencia = PATRON_EN_LINEA.exec(texto)) !== null) {
        if (coincidencia.index > ultimo) partes.push(texto.slice(ultimo, coincidencia.index));
        const [completo, negrita, textoEnlace, urlEnlace, urlSuelta] = coincidencia;
        const k = `${clave}-${coincidencia.index}`;

        if (negrita) {
            partes.push(<strong key={k}>{negrita}</strong>);
        } else if (textoEnlace) {
            partes.push(enlaceSeguro(urlEnlace)
                ? <Enlace key={k} url={urlEnlace}>{textoEnlace}</Enlace>
                : textoEnlace);
        } else if (urlSuelta) {
            partes.push(<Enlace key={k} url={urlSuelta}>{textoEnlaceSuelto(urlSuelta)}</Enlace>);
        } else {
            partes.push(completo);
        }
        ultimo = coincidencia.index + completo.length;
    }
    if (ultimo < texto.length) partes.push(texto.slice(ultimo));
    return partes;
}

export function ContenidoMensaje({ texto }) {
    const bloques = [];
    let lista = null;

    texto.split('\n').forEach((lineaOriginal, indice) => {
        const linea = lineaOriginal.trim();
        const vineta = linea.match(/^[-*•]\s+(.*)$/);
        const numero = linea.match(/^\d+[.)]\s+(.*)$/);
        const tipo = vineta ? 'ul' : numero ? 'ol' : null;

        if (tipo) {
            if (!lista || lista.tipo !== tipo) {
                lista = { tipo, elementos: [] };
                bloques.push(lista);
            }
            lista.elementos.push((vineta || numero)[1]);
            return;
        }

        lista = null;
        if (linea) bloques.push({ tipo: 'p', texto: linea.replace(/^#+\s*/, ''), indice });
    });

    return bloques.map((bloque, i) => {
        if (bloque.tipo === 'p') {
            return <p key={i}>{formatearEnLinea(bloque.texto, i)}</p>;
        }
        const Lista = bloque.tipo;
        return (
            <Lista key={i}>
                {bloque.elementos.map((elemento, j) => (
                    <li key={j}>{formatearEnLinea(elemento, `${i}-${j}`)}</li>
                ))}
            </Lista>
        );
    });
}
