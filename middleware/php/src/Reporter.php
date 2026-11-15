<?php

namespace AiBotTracker;

/**
 * Reports bot visits to the AI Bot Tracker Worker (POST {endpoint}/api/ingest).
 *
 * Same contract as the Node and Python reporters: events are queued and sent in one batch after the response has
 * gone out, with a short timeout, and nothing here ever throws into your application.
 */
class Reporter
{
    private const MAX_QUEUE = 1000;
    private const MAX_BATCH = 100; // the tracker accepts up to 100 events per request

    /** @var string */
    private $url;
    /** @var string */
    private $key;
    /** @var string */
    private $site;
    /** @var float */
    private $timeout;
    /** @var bool */
    private $useCurl;
    /** @var array<int,array<string,mixed>> */
    private $queue = [];
    /** @var bool */
    private $shutdownRegistered = false;

    /**
     * @param array{endpoint?:string,key?:string,site?:string,timeout?:float|int,transport?:string} $config
     *        transport: 'auto' (default: curl when available, else streams), 'curl' or 'stream'. Mostly for tests.
     * @throws \InvalidArgumentException when endpoint, key or site is missing
     */
    public function __construct(array $config)
    {
        foreach (['endpoint', 'key', 'site'] as $required) {
            if (!isset($config[$required]) || !is_string($config[$required]) || $config[$required] === '') {
                throw new \InvalidArgumentException('report needs endpoint, key and site');
            }
        }
        $this->url = rtrim($config['endpoint'], '/') . '/api/ingest';
        $this->key = $config['key'];
        $this->site = $config['site'];
        $this->timeout = max(0.2, (float) ($config['timeout'] ?? 2.0));
        $transport = $config['transport'] ?? 'auto';
        $this->useCurl = $transport !== 'stream' && function_exists('curl_init');
    }

    /** Queue one event ({ip, ua, path, method, status?, referer?}). Sent when the request ends, or on flush(). */
    public function add(array $event): void
    {
        if (count($this->queue) >= self::MAX_QUEUE) {
            array_shift($this->queue);
        }
        $this->queue[] = $event;
        if (!$this->shutdownRegistered) {
            $this->shutdownRegistered = true;
            register_shutdown_function([$this, 'flushAfterResponse']);
        }
    }

    /** Called automatically when the script ends. Lets PHP-FPM finish the visitor's response first. */
    public function flushAfterResponse(): void
    {
        if (function_exists('fastcgi_finish_request')) {
            @fastcgi_finish_request();
        }
        $this->flush();
    }

    /** Send everything queued. Returns true when the tracker accepted every batch, false on any failure. Never throws. */
    public function flush(): bool
    {
        $ok = true;
        try {
            while ($this->queue) {
                $batch = array_splice($this->queue, 0, self::MAX_BATCH);
                // The response status is only known now, at the end of the request.
                $status = function_exists('http_response_code') ? (int) (http_response_code() ?: 200) : 200;
                foreach ($batch as &$event) {
                    $event = ['site' => $this->site] + $event + ['status' => $status];
                }
                unset($event);
                $ok = $this->send($batch) && $ok;
            }
        } catch (\Throwable $e) {
            return false;
        }
        return $ok;
    }

    /** @param array<int,array<string,mixed>> $events */
    private function send(array $events): bool
    {
        // One malformed byte in a user agent (scrapers send them) must not cost the rest of the batch: substitute, never drop.
        $body = json_encode(['events' => $events], JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        if ($body === false) {
            return false;
        }
        $headers = ['Authorization: Bearer ' . $this->key, 'Content-Type: application/json'];

        if ($this->useCurl) {
            $ch = curl_init($this->url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT_MS => (int) ($this->timeout * 1000), CURLOPT_CONNECTTIMEOUT_MS => (int) ($this->timeout * 1000),
            ]);
            $response = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            // No curl_close(): deprecated since PHP 8.5 and a no-op since 8.0. The handle is freed when it goes out of scope.
            return $response !== false && $code >= 200 && $code < 300;
        }

        $context = stream_context_create(['http' => [
            'method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body, 'timeout' => $this->timeout, 'ignore_errors' => true,
        ]]);
        $response = @file_get_contents($this->url, false, $context);
        // $http_response_header is deprecated from PHP 8.4 (a notice on 8.5); http_get_last_response_headers() replaces it.
        $headers = function_exists('http_get_last_response_headers') ? http_get_last_response_headers() : ($http_response_header ?? null);
        $line = isset($headers[0]) ? $headers[0] : '';
        return $response !== false && preg_match('#^HTTP/\S+\s+2\d\d#', $line) === 1;
    }
}
