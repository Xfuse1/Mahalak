"use client";

import React, { useEffect, useRef } from "react";
import { PointerLockControls } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function PlayerController() {
    const { camera } = useThree();
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeft = useRef(false);
    const moveRight = useRef(false);
    const velocity = useRef(new THREE.Vector3());
    const direction = useRef(new THREE.Vector3());

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.code) {
                case "ArrowUp":
                case "KeyW":
                    moveForward.current = true;
                    break;
                case "ArrowLeft":
                case "KeyA":
                    moveLeft.current = true;
                    break;
                case "ArrowDown":
                case "KeyS":
                    moveBackward.current = true;
                    break;
                case "ArrowRight":
                case "KeyD":
                    moveRight.current = true;
                    break;
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            switch (event.code) {
                case "ArrowUp":
                case "KeyW":
                    moveForward.current = false;
                    break;
                case "ArrowLeft":
                case "KeyA":
                    moveLeft.current = false;
                    break;
                case "ArrowDown":
                case "KeyS":
                    moveBackward.current = false;
                    break;
                case "ArrowRight":
                case "KeyD":
                    moveRight.current = false;
                    break;
            }
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    useFrame((state, delta) => {
        // Friction
        velocity.current.x -= velocity.current.x * 10.0 * delta;
        velocity.current.z -= velocity.current.z * 10.0 * delta;

        direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
        direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
        direction.current.normalize();

        if (moveForward.current || moveBackward.current) velocity.current.z -= direction.current.z * 40.0 * delta;
        if (moveLeft.current || moveRight.current) velocity.current.x -= direction.current.x * 40.0 * delta;

        state.camera.translateX(velocity.current.x * delta);
        state.camera.translateZ(velocity.current.z * delta);

        // Lock height to simulate walking
        state.camera.position.y = 1.7;
    });

    return <PointerLockControls />;
}
