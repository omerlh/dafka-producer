import delay from 'delay';
import fetch from 'node-fetch';
import Server from 'simple-fake-server-server-client';

import checkReadiness from '../checkReadiness';

jest.setTimeout(180000);

const fakeHttpServer = new Server({
    baseUrl: `http://localhost`,
    port: 3000,
});

describe('tests', () => {
    beforeAll(async () => {
        // delay(120000);
        await expect(checkReadiness(['foo', 'bar', 'retry', 'dead-letter', 'unexpected'])).resolves.toBeTruthy();
    });

    afterEach(async () => {
        await fakeHttpServer.clear();
    });

    it('liveliness', async () => {
        await delay(1000);
        const producer = await fetch('http://localhost:6000/isAlive');
        const consumer = await fetch('http://localhost:4001/isAlive');
        expect(producer.ok).toBeTruthy();
        expect(consumer.ok).toBeTruthy();
    });

    it('should produce and consume', async () => {
        const callId = await mockHttpTarget('/consume', 200);

        await produce('http://localhost:6000/produce', [
            {
                topic: 'foo',
                key: 'thekey',
                value: {data: 'foo'},
                headers: {eventType: 'test1', source: 'test-service1'},
            },
        ]);
        await delay(1000);
        await produce('http://localhost:6000/produce', [
            {
                topic: 'bar',
                key: 'thekey',
                value: {data: 'bar'},
                headers: {eventType: 'test2', source: 'test-service2'},
            },
        ]);
        await delay(1000);

        const {hasBeenMade, madeCalls} = await fakeHttpServer.getCall(callId);
        expect(hasBeenMade).toBeTruthy();
        expect(madeCalls.length).toBe(2);
        const actualHeaders1 = JSON.parse(madeCalls[0].headers['x-record-headers']);
        const actualHeaders2 = JSON.parse(madeCalls[1].headers['x-record-headers']);
        expect(madeCalls[0].headers['x-record-topic']).toBe('foo');
        expect(actualHeaders1!.eventType).toEqual('test1');
        expect(actualHeaders1!.source).toEqual('test-service1');
        expect(madeCalls[1].headers['x-record-topic']).toBe('bar');
        expect(actualHeaders2!.eventType).toEqual('test2');
        expect(actualHeaders2!.source).toEqual('test-service2');
    });

    it('producer request validation', async () => {
        const method = 'post';
        const producerUrl = 'http://localhost:6000/produce';
        const headers = {'Content-Type': 'application/json'};
        let response;

        response = await fetch(producerUrl, {
            method,
            body: JSON.stringify([{key: 'key', value: {data: 1}}]),
            headers,
        });
        expect(response.status).toBe(400);
        expect(await response.text()).toBe('topic is missing');

        response = await fetch(producerUrl, {
            method,
            body: JSON.stringify([{topic: 'bar', value: {data: 1}}]),
            headers,
        });
        expect(response.status).toBe(400);
        expect(await response.text()).toBe('key is missing');

        response = await fetch(producerUrl, {
            method,
            body: JSON.stringify([{topic: 'bar', key: 'key'}]),
            headers,
        });
        expect(response.status).toBe(400);
        expect(await response.text()).toBe('value is missing');
    });
});

const produce = (url: string, batch: any[]) =>
    fetch(url, {
        method: 'post',
        body: JSON.stringify(batch),
        headers: {'Content-Type': 'application/json'},
    });

const mockHttpTarget = (route: string, statusCode: number) =>
    fakeHttpServer.mock({
        method: 'post',
        url: route,
        statusCode,
    });
