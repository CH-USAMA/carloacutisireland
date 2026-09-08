<?php
/**
 * Form handler for carloacutisireland.org
 *
 * Replaces Weebly's formSubmit.php, which stops working when the Weebly site is
 * shut down. Handles both forms:
 *
 *   index.html -> prayer request / newsletter signup   (cai_form = "prayer")
 *   shop.html  -> merchandise order form               (cai_form = "order")
 *
 * Requires only PHP with a working mail() (or set USE_SMTP notes below).
 * Every submission is also appended to a local log file as a safety net, so a
 * mail outage never silently loses an order.
 */

declare(strict_types=1);

// ---------------------------------------------------------------------------
// CONFIG  — edit these
// ---------------------------------------------------------------------------

/** Where submissions are emailed. Add more addresses to an array entry to CC them. */
const RECIPIENTS = [
    'prayer' => ['info@carloacutisireland.org'],
    'order'  => ['info@carloacutisireland.org'],
    'relic'  => ['info@carloacutisireland.org'],
];

/**
 * The From: address. IMPORTANT: this must be an address at your own domain or
 * most mail hosts will reject or spam-bin the message. Do NOT put the visitor's
 * address here — their address goes in Reply-To instead.
 */
const MAIL_FROM      = 'website@carloacutisireland.org';
const MAIL_FROM_NAME = 'Carlo Acutis Ireland website';

/** Plain-text log of every submission. Keep it OUTSIDE the web root if you can. */
const LOG_FILE = __DIR__ . '/form-submissions.log';

/** Simple flood control: max submissions per IP per hour. 0 disables. */
const RATE_LIMIT_PER_HOUR = 10;

/** Reject anything submitted faster than this many seconds after page load. */
const MIN_SECONDS_ON_PAGE = 3;

// ---------------------------------------------------------------------------
// Form definitions — maps Weebly's opaque field names to readable labels.
// ---------------------------------------------------------------------------

const FORMS = [
    'prayer' => [
        'title'    => 'Prayer request / newsletter signup',
        'subject'  => 'New prayer request from the website',
        'back'     => 'index.html',
        'fields'   => [
            '_u337924750266719509' => ['label' => 'Prayer request', 'required' => true,  'type' => 'text'],
            '_u995285208740708601' => ['label' => 'Email',          'required' => true,  'type' => 'email'],
        ],
        'heading'  => 'Thank you — your prayer request has been received.',
        'message'  => 'Your intention will be prayed for with the relic of Carlo Acutis. '
                    . 'If you included your email address we will also keep you up to date with '
                    . 'news and events, including our monthly online prayer nights.',
    ],
    'order' => [
        'title'    => 'Merchandise order',
        'subject'  => 'New shop order from the website',
        'back'     => 'shop.html',
        'fields'   => [
            '_u952557491606322518' => ['label' => 'Name',           'required' => true,  'type' => 'name'],
            '_u563578059649482898' => ['label' => 'Email address',  'required' => true,  'type' => 'email'],
            '_u788054102918956424' => ['label' => 'Phone number',   'required' => true,  'type' => 'phone'],
            '_u903979328726697630' => ['label' => 'Items requested','required' => true,  'type' => 'text'],
        ],
        'heading'  => 'Thank you — your order has been received.',
        'message'  => 'Please note: Once you submit your order form, it will be reviewed by our '
                    . 'team administrator. We will contact you as soon as possible to confirm your '
                    . 'order details, discuss payment options, and arrange delivery. Thank you for '
                    . 'your patience, and we look forward to helping you with your Carlo Acutis '
                    . 'merchandise!',
    ],
    'relic' => [
        'title'    => 'Relic visit request',
        'subject'  => 'Relic visit request from the website',
        'back'     => 'relicvisit.html',
        'fields'   => [
            'parish'  => ['label' => 'Parish or church',  'required' => true,  'type' => 'text'],
            'diocese' => ['label' => 'Diocese or county', 'required' => true,  'type' => 'text'],
            'name'    => ['label' => 'Contact name',      'required' => true,  'type' => 'name'],
            'email'   => ['label' => 'Email',             'required' => true,  'type' => 'email'],
            'phone'   => ['label' => 'Phone',             'required' => false, 'type' => 'phone'],
            'timing'  => ['label' => 'Preferred timing',  'required' => false, 'type' => 'text'],
            'notes'   => ['label' => 'Anything else',     'required' => false, 'type' => 'text'],
        ],
        'heading'  => 'Thank you — your parish has been entered.',
        'message'  => 'We will be in touch by email to help with the arrangements. That '
                    . 'includes producing a schedule for the visit, subject to approval from '
                    . 'your parish priest; arranging a meeting with your parish to confirm '
                    . 'details beforehand; promoting the visit on our website and social '
                    . 'pages; and providing assistance on the day of the visit.',
    ],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function e(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

/** Collapse a posted value (string, or Weebly's name[first]/[last] array) to text. */
function flatten($value, string $type): string
{
    if (is_array($value)) {
        if ($type === 'name') {
            $parts = array_filter([
                trim((string) ($value['first'] ?? '')),
                trim((string) ($value['last'] ?? '')),
            ], 'strlen');
            return implode(' ', $parts);
        }
        if ($type === 'phone') {
            return trim((string) ($value['number'] ?? implode(' ', array_map('strval', $value))));
        }
        $flat = [];
        array_walk_recursive($value, function ($v) use (&$flat) { $flat[] = trim((string) $v); });
        return implode(' ', array_filter($flat, 'strlen'));
    }
    return trim((string) $value);
}

/** Strip CR/LF so a submitted value can never inject extra mail headers. */
function header_safe(string $s): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $s));
}

function rate_limited(): bool
{
    if (RATE_LIMIT_PER_HOUR <= 0) {
        return false;
    }
    $file = sys_get_temp_dir() . '/cai_rate_' . md5(client_ip()) . '.txt';
    $now  = time();
    $hits = [];
    if (is_readable($file)) {
        $hits = array_filter(
            array_map('intval', explode(',', (string) file_get_contents($file))),
            fn($t) => $t > $now - 3600
        );
    }
    if (count($hits) >= RATE_LIMIT_PER_HOUR) {
        return true;
    }
    $hits[] = $now;
    @file_put_contents($file, implode(',', $hits), LOCK_EX);
    return false;
}

/** Render a full themed page and stop. */
function render(string $heading, string $body, string $backHref, string $backLabel, bool $isError = false): void
{
    http_response_code($isError ? 400 : 200);
    $accent = $isError ? '#a3342b' : '#2f4f4d';
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($heading) ?> — Carlo Acutis Ireland</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; padding: 0; background: #f6f6f6; color: #333;
    font: 17px/1.65 Cardo, Lora, Georgia, "Times New Roman", serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 680px; margin: 0 auto; padding: 60px 24px 80px; }
  .brand {
    text-align: center; letter-spacing: .14em; text-transform: uppercase;
    font-family: Montserrat, "Helvetica Neue", Arial, sans-serif;
    font-size: 15px; color: #6b6b6b; margin-bottom: 46px;
  }
  .card {
    background: #fff; border-top: 4px solid <?= $accent ?>;
    padding: 40px 38px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
  }
  h1 { margin: 0 0 18px; font-size: 27px; line-height: 1.3; color: <?= $accent ?>; font-weight: 700; }
  p  { margin: 0 0 16px; }
  ul { margin: 0 0 16px; padding-left: 22px; }
  li { margin-bottom: 6px; }
  .back { display: inline-block; margin-top: 18px; padding: 11px 22px;
          background: <?= $accent ?>; color: #fff; text-decoration: none;
          font-family: Montserrat, "Helvetica Neue", Arial, sans-serif;
          font-size: 13px; letter-spacing: .09em; text-transform: uppercase; }
  .back:hover { opacity: .88; }
  .foot { text-align: center; margin-top: 40px; font-size: 14px; color: #8a8a8a; }
  .foot a { color: #6b6b6b; }
  @media (max-width: 560px) { .wrap { padding: 36px 16px 60px; } .card { padding: 28px 22px; } h1 { font-size: 23px; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">Carlo Acutis Ireland</div>
    <div class="card">
      <h1><?= e($heading) ?></h1>
      <?= $body ?>
      <a class="back" href="<?= e($backHref) ?>"><?= e($backLabel) ?></a>
    </div>
    <div class="foot">
      Need help? Email <a href="mailto:info@carloacutisireland.org">info@carloacutisireland.org</a>
    </div>
  </div>
</body>
</html>
<?php
    exit;
}

// ---------------------------------------------------------------------------
// Handle the request
// ---------------------------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Location: index.html', true, 302);
    exit;
}

$formKey = (string) ($_POST['cai_form'] ?? '');
if (!isset(FORMS[$formKey])) {
    render(
        'Something went wrong',
        '<p>We could not tell which form this was sent from, so it was not delivered. '
        . 'Please go back and try again, or email us directly.</p>',
        'index.html',
        'Back to the site',
        true
    );
}
$form = FORMS[$formKey];

// -- Spam checks -------------------------------------------------------------

// 1. Honeypot: a field hidden from humans. Bots fill it in.
if (trim((string) ($_POST['cai_website'] ?? '')) !== '') {
    // Pretend it worked so the bot does not retry.
    render($form['heading'], '<p>' . e($form['message']) . '</p>', $form['back'], 'Back to the site');
}

// 2. Submitted implausibly fast.
$loadedAt = (int) ($_POST['cai_ts'] ?? 0);
if ($loadedAt > 0 && (time() - $loadedAt) < MIN_SECONDS_ON_PAGE) {
    render(
        'Please try once more',
        '<p>That was submitted a little too quickly for us to be sure it was not automated. '
        . 'Please go back and send it again.</p>',
        $form['back'],
        'Back to the form',
        true
    );
}

// 3. Flood control.
if (rate_limited()) {
    render(
        'Too many submissions',
        '<p>Several messages have already been sent from this connection in the last hour. '
        . 'Please wait a little while and try again, or email us directly at '
        . '<a href="mailto:info@carloacutisireland.org">info@carloacutisireland.org</a>.</p>',
        $form['back'],
        'Back to the form',
        true
    );
}

// -- Collect and validate ----------------------------------------------------

$values = [];
$errors = [];

foreach ($form['fields'] as $name => $spec) {
    $value = flatten($_POST[$name] ?? '', $spec['type']);
    $values[$spec['label']] = $value;

    if ($spec['required'] && $value === '') {
        $errors[] = $spec['label'] . ' is required.';
        continue;
    }
    if ($value !== '' && $spec['type'] === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
        $errors[] = $spec['label'] . ' does not look like a valid email address.';
    }
    if ($value !== '' && $spec['type'] === 'phone' && !preg_match('/[0-9]{6,}/', preg_replace('/\D+/', '', $value))) {
        $errors[] = $spec['label'] . ' does not look like a valid phone number.';
    }
}

if ($errors) {
    $list = '<ul><li>' . implode('</li><li>', array_map('e', $errors)) . '</li></ul>';
    render(
        'Please check the form',
        '<p>We could not send your message because:</p>' . $list
        . '<p>Nothing was lost — go back and the details you typed should still be there.</p>',
        $form['back'],
        'Back to the form',
        true
    );
}

// -- Build the email ---------------------------------------------------------

$replyTo = '';
foreach ($form['fields'] as $name => $spec) {
    if ($spec['type'] === 'email' && !empty($values[$spec['label']])) {
        $replyTo = $values[$spec['label']];
        break;
    }
}

$lines = [];
$lines[] = $form['title'];
$lines[] = str_repeat('=', strlen($form['title']));
$lines[] = '';
foreach ($values as $label => $value) {
    $lines[] = $label . ':';
    $lines[] = ($value === '' ? '(not provided)' : $value);
    $lines[] = '';
}
$lines[] = str_repeat('-', 46);
$lines[] = 'Sent: ' . date('D, j M Y H:i:s T');
$lines[] = 'IP:   ' . client_ip();
$lines[] = 'Page: ' . header_safe((string) ($_POST['cai_page'] ?? $form['back']));

$body = implode("\n", $lines);

$headers = [
    'From: ' . MAIL_FROM_NAME . ' <' . MAIL_FROM . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'MIME-Version: 1.0',
    'X-Mailer: carloacutisireland.org',
];
if ($replyTo !== '') {
    $headers[] = 'Reply-To: ' . header_safe($replyTo);
}

// -- Log first, so nothing is ever lost even if mail() fails -----------------

$logEntry = "\n===== " . date('c') . " [{$formKey}] from " . client_ip() . " =====\n" . $body . "\n";
@file_put_contents(LOG_FILE, $logEntry, FILE_APPEND | LOCK_EX);

// -- Send --------------------------------------------------------------------

$sent = false;
foreach (RECIPIENTS[$formKey] as $to) {
    if (@mail($to, $form['subject'], $body, implode("\r\n", $headers), '-f' . MAIL_FROM)) {
        $sent = true;
    }
}

if (!$sent) {
    render(
        'We could not send that automatically',
        '<p>Your details were saved on the server, but our mail system did not accept the '
        . 'message. So nothing is delayed, please email us directly at '
        . '<a href="mailto:info@carloacutisireland.org">info@carloacutisireland.org</a> '
        . 'and we will pick it up straight away.</p>',
        $form['back'],
        'Back to the site',
        true
    );
}

render($form['heading'], '<p>' . e($form['message']) . '</p>', $form['back'], 'Back to the site');
