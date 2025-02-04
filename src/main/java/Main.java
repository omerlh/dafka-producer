public class Main {

    static Config config;
    static Monitor monitor;
    static Producer producer;
    static Server server;

    public static void main(String[] args) throws Exception {
        Config.init();
        Monitor.init();
        Monitor.startingService();
        producer = new Producer(config, monitor);
        server = new Server(config, monitor, producer);
        server.start();
        producer.start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> close()));
    }

    private static void close() {
        producer.close();
        server.close();
        Monitor.serviceShutdown();
    }
}
