import React, { useEffect, useState } from 'react';
import * as THREE from 'https://cdn.skypack.dev/three@0.129.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/GLTFLoader.js';
import { Line2 } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/lines/LineMaterial.js';

const parseGltf = (gltf) => {
    const graph = { nodes: [], edges: [] };
    const proximityThreshold = 0.25;  // Define your proximity threshold here

    gltf.scene.traverse((node) => {
        if (node.isMesh) {
            const position = new THREE.Vector3();
            node.getWorldPosition(position);

            // Check if there's an existing node within the proximity threshold
            let isClose = false;
            for (const existingNode of graph.nodes) {
                if (position.distanceTo(existingNode.position) < proximityThreshold) {
                    isClose = true;
                    break;
                }
            }

            // Only add the node if no existing node is within the threshold
            if (!isClose) {
                graph.nodes.push({
                    id: node.uuid,
                    position: position.clone(),
                });
            }
        }
    });
    console.log(graph.nodes.length);

    // Create edges by connecting each node to the next one
    for (let i = 0; i < graph.nodes.length - 1; i++) {
        for (let j = 0; j < 2; j++) {
            let k = Math.floor(((Math.random()) * 10000) % (graph.nodes.length));
            graph.edges.push({
                i: i,
                j: k,
                start: graph.nodes[i].position,
                end: graph.nodes[k].position,
            });
        }
    }
    
    return graph;
};

const pathfinder = (graph) => {
    const nodes = graph.nodes;
    const edges = graph.edges;
    const nodeCount = nodes.length;
    console.log(nodeCount)
    const adjacencyMatrix = Array(nodeCount).fill().map(() => Array(nodeCount).fill(Infinity));
    for (const edge of edges) {
        const i = edge.i;
        const j = edge.j;
        const distance = nodes[i].position.distanceTo(nodes[j].position);
        adjacencyMatrix[i][j] = distance;
        adjacencyMatrix[j][i] = distance;
    }

    const dijkstra = (start, end) => {
        const distances = Array(nodeCount).fill(Infinity);
        const previous = Array(nodeCount).fill(null);
        const visited = Array(nodeCount).fill(false);
        console.log(distances);
        console.log(previous);
        console.log(visited);
        distances[start] = 0;

        for (let i = 0; i < nodeCount; i++) {
            let u = -1;
            for (let j = 0; j < nodeCount; j++) {
                if (!visited[j] && (u === -1 || distances[j] < distances[u])) {
                    u = j;
                }
            }
            if (distances[u] === Infinity) break;
            visited[u] = true;
            for (let v = 0; v < nodeCount; v++) {
                if (!visited[v] && adjacencyMatrix[u][v] !== Infinity) {
                    const alt = distances[u] + adjacencyMatrix[u][v];
                    if (alt < distances[v]) {
                        distances[v] = alt;
                        previous[v] = u;
                    }
                }
            }
        }
        console.log(distances);
        console.log(previous);
        console.log(visited);
        let end_ = start;
        for(let k = nodeCount-1; k > 0; k --){
            if(visited[k]==true){
                end_ = k;
                break;
            }
        }
        const path = [];
        for (let at = end_; at !== null; at = previous[at]) {
            path.push(at);
        }
        path.reverse();
        return path;
    };

    const startNode = 5;
    const endNode = nodeCount-1;
    const shortestPath = dijkstra(startNode, endNode);
    return shortestPath;
}

const ModelViewer = () => {
    const [graph, setGraph] = useState(null);
    const [model, setModel] = useState(null); // State to hold the original model
    const [path, setPath] = useState(null);

    useEffect(() => {
        const loader = new GLTFLoader();
        loader.load(
            '/airplane/scene.gltf',
            (gltf) => {
                const graph_ = parseGltf(gltf);
                setGraph(graph_);
                const path_ = pathfinder(graph_);
                setPath(path_);
                
                // Traverse the model to modify its materials
                gltf.scene.traverse((node) => {
                    if (node.isMesh) {
                        node.material = new THREE.MeshLambertMaterial({
                            color: 0xffffff, // Set color to white
                            transparent: true,
                            opacity: 0.5, // Set desired opacity
                        });
                    }
                });
                
                setModel(gltf.scene); // Set the original model
            }
        );
    }, []);
    
    useEffect(() => {
        if (graph && model) {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer();
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            // Initialize OrbitControls
            const controls = new OrbitControls(camera, renderer.domElement);

            // Add lights to the scene
            const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 5, 5).normalize();
            scene.add(directionalLight);

            // Add the original model to the scene
            scene.add(model);

            // Add spheres to the scene
            for (const node of graph.nodes) {
                const geometry = new THREE.SphereGeometry(0.04, 32, 32); // Use sphereRadius variable here
                const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const sphere = new THREE.Mesh(geometry, material);
                sphere.position.copy(node.position);
                scene.add(sphere);
            }

            // Add edges to the scene
            for (const edge of graph.edges) {
                const geometry = new THREE.BufferGeometry().setFromPoints([edge.start, edge.end]);
                const material = new THREE.LineBasicMaterial({ color: 0xE1F02B });
                const line = new THREE.Line(geometry, material);
                scene.add(line);
            }

            const lineMaterials = [];
            const lineGeometries = [];
            const lines = [];
            const segmentLength = 0.05; // Adjust for the speed of line creation

            for (let i = 0; i < path.length - 1; i++) {
                const start = graph.nodes[path[i]].position;
                const end = graph.nodes[path[i + 1]].position;

                const lineGeometry = new LineGeometry();
                lineGeometry.setPositions([start.x, start.y, start.z, start.x, start.y, start.z]);

                const lineMaterial = new LineMaterial({
                    color: 0xff0000,
                    linewidth: 0.005, // Adjust this value for thickness
                });

                const line = new Line2(lineGeometry, lineMaterial);
                scene.add(line);

                lineGeometries.push(lineGeometry);
                lineMaterials.push(lineMaterial);
                lines.push({ start, end, currentProgress: 0 });
            }

            let currentLineIndex = 0;

            const animateLineCreation = () => {
                if (currentLineIndex < lines.length) {
                    const line = lines[currentLineIndex];
                    const start = line.start;
                    const end = line.end;
                    line.currentProgress += segmentLength;

                    const progress = Math.min(line.currentProgress, 1);
                    const currentPos = new THREE.Vector3().lerpVectors(start, end, progress);
                    const positions = [
                        start.x, start.y, start.z,
                        currentPos.x, currentPos.y, currentPos.z
                    ];

                    lineGeometries[currentLineIndex].setPositions(positions);
                    lineMaterials[currentLineIndex].needsUpdate = true;

                    if (progress < 1) {
                        requestAnimationFrame(animateLineCreation);
                    } else {
                        currentLineIndex++;
                        setTimeout(() => {
                            requestAnimationFrame(animateLineCreation);
                        }, 250); // Add delay before starting the next line
                    }
                }
            };

            camera.position.z = 5;
    
            const animate = () => {
                requestAnimationFrame(animate);
                controls.update(); // Update controls
                renderer.render(scene, camera);
            };

            animateLineCreation();
            animate();
        }
    }, [graph, model]);

    return null;
}

export default ModelViewer;
