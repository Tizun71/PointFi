// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseTest.sol";

contract LendingPoolTest is BaseTest {
    
    function testDeposit() public {
        vm.startPrank(liquidityProvider);
        
        uint256 depositAmount = 10 ether;
        
        vm.expectEmit(true, false, false, true);
        emit Deposited(liquidityProvider, depositAmount, depositAmount);
        
        lendingPool.deposit{value: depositAmount}();
        
        assertEq(lendingPool.deposits(liquidityProvider), depositAmount);
        assertEq(lendingPool.totalLiquidity(), depositAmount);
        
        vm.stopPrank();
    }
    
    function testWithdraw() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(liquidityProvider);
        lendingPool.withdraw(5 ether);
        
        assertEq(lendingPool.deposits(liquidityProvider), 5 ether);
        assertEq(lendingPool.totalLiquidity(), 5 ether);
    }
    
    function testCannotWithdrawMoreThanBalance() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 5 ether}();
        
        vm.prank(liquidityProvider);
        vm.expectRevert();
        lendingPool.withdraw(10 ether);
    }
    
    function testOnlyLoanManagerCanProvideLoan() public {
        vm.prank(liquidityProvider);
        lendingPool.deposit{value: 10 ether}();
        
        vm.prank(attacker);
        vm.expectRevert();
        lendingPool.provideLoan(borrower, 1 ether);
    }
}
