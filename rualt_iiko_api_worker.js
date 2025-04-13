const WELCOME_HTML = `<!DOCTYPE html>
<html>
<head>
    <title>iiko API Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        code { background: #f0f0f0; padding: 2px 5px; }
    </style>
</head>
<body>
    <h1>iiko API Proxy Service</h1>
    <p>Этот Worker проксирует запросы к iiko API. Используйте:</p>
    
    <h2>Пример запроса:</h2>
    <pre><code>POST /api
Content-Type: application/json

{
  "endpoint": "/api/1/access_token",
  "body": {
    "apiLogin": "ваш_api_ключ"
  }
}</code></pre>

    <h2>Доступные эндпоинты:</h2>
    <ul>
        <li><code>/api/1/access_token</code> - получение токена</li>
        <li><code>/api/1/organizations</code> - список организаций</li>
        <li><code>/api/2/menu</code> - получение меню</li>
        <li><code>/api/1/terminal_groups</code> - получение терминалов</li>
        <li><code>/api/1/deliveries/order_types</code> - получение типов заказов</li>
        <li><code>/api/1/payment_types</code> - получение типов оплат</li>
    </ul>
</body>
</html>`;

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
        return new Response(WELCOME_HTML, {
            headers: { 
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    if (url.pathname === '/api') {
        return handleApiRequest(request);
    }

    return new Response('Not Found', { 
        status: 404,
        headers: { 
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleApiRequest(request) {
    const IIKO_API_URL = 'https://api-ru.iiko.services';
    
    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { 
            status: 405,
            headers: { 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        const { endpoint, body } = await request.json();
        
        // Формируем правильное тело запроса для iiko API
        let apiRequestBody;
        const headers = {
            'Content-Type': 'application/json'
        };

        switch(endpoint) {
            case '/api/1/access_token':
                apiRequestBody = { apiLogin: body.apiLogin };
                break;
                
            case '/api/1/organizations':
                apiRequestBody = {
                    organizationIds: null,
                    returnAdditionalInfo: body.returnAdditionalInfo || false,
                    includeDisabled: body.includeDisabled || false
                };
                if (body.token) headers['Authorization'] = `Bearer ${body.token}`;
                break;
                
            case '/api/2/menu':
                apiRequestBody = {
                    organizationId: body.organizationId,
                    startRevision: body.startRevision || 0
                };
                if (body.token) headers['Authorization'] = `Bearer ${body.token}`;
                break;
                
            case '/api/1/terminal_groups':
                apiRequestBody = {
                    organizationIds: body.organizationIds || [],
                    includeDisabled: body.includeDisabled || false
                };
                if (body.token) headers['Authorization'] = `Bearer ${body.token}`;
                break;
                
            case '/api/1/deliveries/order_types':
            case '/api/1/payment_types':
                apiRequestBody = {
                    organizationIds: body.organizationIds || []
                };
                if (body.token) headers['Authorization'] = `Bearer ${body.token}`;
                break;
                
            default:
                return new Response('Forbidden endpoint', { 
                    status: 403,
                    headers: { 'Access-Control-Allow-Origin': '*' }
                });
        }

        // Валидация GUID перед отправкой
        if (apiRequestBody.organizationIds) {
            apiRequestBody.organizationIds = apiRequestBody.organizationIds.filter(id => 
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
            );
            
            if (apiRequestBody.organizationIds.length === 0) {
                throw new Error('Неверный формат ID организации');
            }
        }

        const apiResponse = await fetch(IIKO_API_URL + endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(apiRequestBody)
        });

        return new Response(await apiResponse.text(), {
            status: apiResponse.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}