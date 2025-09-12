<?php
namespace PHPUnit\Framework;

class AssertionFailedError extends \Exception {}

class TestCase
{
    protected function setUp(): void {}
    protected function tearDown(): void {}

    protected function fail(string $msg): void
    {
        throw new AssertionFailedError($msg);
    }

    protected function assertTrue($cond, string $msg = ''): void
    {
        if (!$cond) {
            $this->fail($msg ?: 'Failed asserting that condition is true.');
        }
    }

    protected function assertFalse($cond, string $msg = ''): void
    {
        if ($cond) {
            $this->fail($msg ?: 'Failed asserting that condition is false.');
        }
    }

    protected function assertEquals($expected, $actual, string $msg = ''): void
    {
        if ($expected != $actual) {
            $this->fail($msg ?: 'Failed asserting that ' . var_export($actual, true) . ' matches expected ' . var_export($expected, true));
        }
    }

    protected function assertSame($expected, $actual, string $msg = ''): void
    {
        if ($expected !== $actual) {
            $this->fail($msg ?: 'Failed asserting that ' . var_export($actual, true) . ' is identical to ' . var_export($expected, true));
        }
    }

    protected function assertNotNull($actual, string $msg = ''): void
    {
        if ($actual === null) {
            $this->fail($msg ?: 'Failed asserting that value is not null.');
        }
    }

    protected function assertIsInt($actual, string $msg = ''): void
    {
        if (!is_int($actual)) {
            $this->fail($msg ?: 'Failed asserting that value is int.');
        }
    }

    protected function assertCount($expected, $array, string $msg = ''): void
    {
        $this->assertEquals($expected, count($array), $msg);
    }

    protected function assertStringContainsString(string $needle, string $haystack, string $msg = ''): void
    {
        $this->assertTrue(strpos($haystack, $needle) !== false, $msg ?: "Failed asserting that string contains '$needle'.");
    }

    protected function assertStringStartsWith(string $prefix, string $string, string $msg = ''): void
    {
        $this->assertTrue(strncmp($string, $prefix, strlen($prefix)) === 0, $msg ?: "Failed asserting that string starts with '$prefix'.");
    }
}
